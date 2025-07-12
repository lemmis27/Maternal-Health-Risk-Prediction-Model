# maternal_health_project/train.py

import pandas as pd
import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sklearn.model_selection import train_test_split, StratifiedKFold, GridSearchCV
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
import xgboost as xgb

from config import ModelConfig, load_config
from logger import ProductionLogger
from data_processing import load_data, handle_outliers
from features import FeatureEngineer
from evaluation import clinical_model_evaluation
from pipeline import MaternalRiskPipeline

def train_model(config: ModelConfig, logger: logging.Logger) -> MaternalRiskPipeline:
    """
    Main training function for the maternal risk prediction model.

    This function orchestrates the entire training process:
    1. Loads and preprocesses data (outlier handling).
    2. Encodes the target variable.
    3. Splits data into training and testing sets.
    4. Applies feature engineering and scaling.
    5. Performs hyperparameter tuning with SMOTE and XGBoost.
    6. Calibrates the best model.
    7. Evaluates the model clinically.
    8. Constructs and saves the production-ready pipeline.
    9. Saves model metadata.

    Args:
        config (ModelConfig): Configuration object containing model parameters and paths.
        logger (logging.Logger): Logger instance for logging training progress.

    Returns:
        MaternalRiskPipeline: The trained and saved production pipeline.

    Raises:
        Exception: If any step in the training process fails.
    """
    logger.info("Starting model training pipeline")

    try:
        # 1. Load and preprocess data
        df = load_data(config.data_file, logger)
        df = handle_outliers(df, ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate'],
                           method='clip', config=config, logger=logger)

        # 2. Encode target variable
        le = LabelEncoder()
        df['RiskLevel'] = le.fit_transform(df['RiskLevel'])
        original_classes = le.classes_
        logger.info(f"Target classes encoded: {original_classes}")

        # 3. Split data
        X = df.drop('RiskLevel', axis=1)
        y = df['RiskLevel']
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=config.test_size, stratify=y, random_state=config.random_state
        )
        logger.info(f"Data split - Train samples: {len(X_train)}, Test samples: {len(X_test)}")

        # 4. Feature engineering and scaling setup
        feature_engineer = FeatureEngineer(logger)
        scaler = StandardScaler()

        # Apply feature engineering and scaling
        # Note: FeatureEngineer.fit_transform is called on X_train, then transform on X_test
        # StandardScaler.fit_transform on X_train_engineered, then transform on X_test_engineered
        X_train_engineered = feature_engineer.fit_transform(X_train)
        # Remove rows with any NaN in features or target
        nan_mask = X_train_engineered.isna().any(axis=1)
        if nan_mask.any():
            logger.warning(f"Removing {nan_mask.sum()} rows with NaN values after feature engineering.")
            X_train_engineered = X_train_engineered[~nan_mask]
            y_train = y_train[~nan_mask]
        X_train_scaled = scaler.fit_transform(X_train_engineered)

        # Ensure X_test goes through the same transformation steps
        X_test_engineered = feature_engineer.transform(X_test)
        # Optionally remove NaNs in test set for consistency
        nan_mask_test = X_test_engineered.isna().any(axis=1)
        if nan_mask_test.any():
            logger.warning(f"Removing {nan_mask_test.sum()} rows with NaN values in test set after feature engineering.")
            X_test_engineered = X_test_engineered[~nan_mask_test]
            y_test = y_test[~nan_mask_test]
        X_test_scaled = scaler.transform(X_test_engineered)
        logger.info("Feature engineering and scaling completed for train and test sets.")

        # 5. Model training with hyperparameter tuning (XGBoost with SMOTE)
        logger.info("Starting hyperparameter tuning for XGBoost classifier.")

        base_model = xgb.XGBClassifier(
            random_state=config.random_state,
            eval_metric='mlogloss', # Multi-class logloss
            #use_label_encoder=False # Suppress deprecation warning
        )

        # Pipeline with SMOTE for handling class imbalance and classifier
        pipeline_with_smote = ImbPipeline([
            ('smote', SMOTE(random_state=config.random_state)),
            ('classifier', base_model)
        ])

        param_grid = {
            'classifier__n_estimators': [200, 300],
            'classifier__max_depth': [4, 6],
            'classifier__learning_rate': [0.01, 0.1],
            'classifier__subsample': [0.8, 1.0]
        }

        skf = StratifiedKFold(n_splits=config.cross_validation_folds, shuffle=True,
                             random_state=config.random_state)

        grid_search = GridSearchCV(
            pipeline_with_smote, param_grid, cv=skf, scoring='balanced_accuracy',
            n_jobs=-1, verbose=1
        )
        grid_search.fit(X_train_scaled, y_train)

        best_classifier = grid_search.best_estimator_.named_steps['classifier']
        logger.info(f"Best parameters found: {grid_search.best_params_}")
        logger.info(f"Best balanced accuracy score: {grid_search.best_score_:.4f}")

        # 6. Model calibration
        logger.info("Calibrating the best model using Isotonic regression.")
        # CalibratedClassifierCV needs to be fitted on the original (non-SMOTEd) data
        # or a separate calibration set. Here, we use cross-validation on X_train_scaled.
        calibrated_model = CalibratedClassifierCV(best_classifier, cv=5, method='isotonic')
        calibrated_model.fit(X_train_scaled, y_train)
        logger.info("Model calibration completed.")

        # 7. Evaluation (using calibrated model directly)
        logger.info("Evaluating calibrated model performance on the test set.")
        metrics = clinical_model_evaluation(
            calibrated_model, X_test_scaled, y_test, original_classes.tolist(), config.risk_costs, logger
        )
        logger.info(f"Final Model Performance - Accuracy: {metrics['accuracy']:.4f}, "
                   f"F1-weighted: {metrics['f1_weighted']:.4f}, Clinical Cost: {metrics['clinical_cost']}")

        # 8. Create and save production pipeline (using calibrated model directly)
        logger.info("Constructing and saving the production pipeline.")
        prod_pipeline = MaternalRiskPipeline(
            feature_engineer, scaler, calibrated_model, le, config, logger
        )
        # Patch: force correct module path for pickling
        MaternalRiskPipeline.__module__ = "pipeline"
        model_path = Path(config.model_output_dir) / "maternal_risk_pipeline.joblib"
        prod_pipeline.save_model(str(model_path))

        # 9. Save metadata
        metadata = {
            'version': prod_pipeline.version,
            'training_date': prod_pipeline.created_at,
            'metrics': metrics,
            'config': config.__dict__, # Save the full config for reproducibility
            'model_type': 'calibrated_xgboost', # Indicate simplified model type
            'ensemble_removed': True # Flag that VotingClassifier was removed
        }
        metadata_path = Path(config.model_output_dir) / "model_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
        logger.info(f"Model metadata saved to {metadata_path}")

        logger.info("Training completed successfully!")
        return prod_pipeline

    except Exception as e:
        logger.error(f"An error occurred during model training: {e}", exc_info=True)
        raise # Re-raise the exception after logging

def main():
    """
    Main function to run the training pipeline.
    """
    # Load configuration
    config = load_config()
    
    # Setup logging
    logger = ProductionLogger(config, service_name="maternal_risk_model").get_logger()
    
    try:
        # Train the model
        pipeline = train_model(config, logger)
        logger.info("Training completed successfully!")
        
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    main()

