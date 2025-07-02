# maternal_health_project/pipeline.py

import pandas as pd
import numpy as np
import logging
import joblib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from sklearn.preprocessing import LabelEncoder, StandardScaler
from features import FeatureEngineer # Import FeatureEngineer
from config import ModelConfig # Import ModelConfig

class MaternalRiskPipeline:
    """
    Production-ready maternal risk prediction pipeline.
    Encapsulates feature engineering, scaling, model prediction, and alert generation.
    """

    def __init__(self, feature_engineer: FeatureEngineer, scaler: StandardScaler,
                 model: Any, label_encoder: LabelEncoder, config: ModelConfig,
                 logger: logging.Logger):
        self.feature_engineer = feature_engineer
        self.scaler = scaler
        self.model = model
        self.label_encoder = label_encoder
        self.config = config
        self.logger = logger

        # Store encoded indices for risk levels
        self.high_risk_idx: int = -1
        self.mid_risk_idx: int = -1
        self.low_risk_idx: int = -1
        self._setup_risk_indices()

        # Metadata for saved model
        self.version: str = "1.0.0"
        self.created_at: str = datetime.now().isoformat()

    def _setup_risk_indices(self):
        """
        Setup risk level indices for alert generation based on the LabelEncoder's classes.
        """
        try:
            # Ensure all expected risk levels are present in the encoder's classes
            expected_classes = ['high risk', 'mid risk', 'low risk']
            for risk_level in expected_classes:
                if risk_level not in self.label_encoder.classes_:
                    raise ValueError(f"LabelEncoder missing expected class: '{risk_level}'")

            self.high_risk_idx = list(self.label_encoder.classes_).index('high risk')
            self.mid_risk_idx = list(self.label_encoder.classes_).index('mid risk')
            self.low_risk_idx = list(self.label_encoder.classes_).index('low risk')
            self.logger.info(f"Risk indices set: High={self.high_risk_idx}, Mid={self.mid_risk_idx}, Low={self.low_risk_idx}")
        except ValueError as e:
            self.logger.error(f"Error setting up risk indices. Ensure LabelEncoder is fitted with 'high risk', 'mid risk', and 'low risk': {e}")
            raise

    def save_model(self, filepath: str):
        """
        Securely saves the entire pipeline using joblib.

        Args:
            filepath (str): The path where the model will be saved.
        """
        Path(filepath).parent.mkdir(parents=True, exist_ok=True)

        # Update metadata before saving (though typically done once at training)
        self.version = "1.0.0" # Can be updated dynamically if versioning logic exists
        self.created_at = datetime.now().isoformat()

        try:
            joblib.dump(self, filepath, compress=3)  # Using compression level 3
            self.logger.info(f"Model saved successfully to {filepath}")
        except Exception as e:
            self.logger.error(f"Failed to save model to {filepath}: {e}")
            raise

    @classmethod
    def load_model(cls, filepath: str, logger: Optional[logging.Logger] = None):
        """
        Loads a saved pipeline from disk.

        Args:
            filepath (str): Path to the saved pipeline file.
            logger (Optional[logging.Logger]): Optional logger instance.

        Returns:
            MaternalRiskPipeline: The loaded MaternalRiskPipeline instance.

        Raises:
            FileNotFoundError: If the model file does not exist.
            Exception: For other errors during model loading.
        """
        if not Path(filepath).exists():
            raise FileNotFoundError(f"Model file not found at: {filepath}")

        try:
            if logger:
                logger.info(f"Loading model from {filepath}")
            pipeline = joblib.load(filepath)
            if logger:
                logger.info(f"Model version {getattr(pipeline, 'version', 'N/A')} loaded successfully")
                logger.info(f"Model created at: {getattr(pipeline, 'created_at', 'N/A')}")
            return pipeline
        except Exception as e:
            if logger:
                logger.error(f"Failed to load model from {filepath}: {e}")
            raise

    def _generate_alert(self, probabilities: np.ndarray) -> Dict[str, Any]:
        """
        Generate clinical alerts based on probability thresholds and risk indices.

        Args:
            probabilities (np.ndarray): NumPy array of probabilities for each risk class.

        Returns:
            Dict[str, Any]: Dictionary containing alert level, message, urgency, risk score, and category.

        Raises:
            ValueError: If probabilities are invalid.
            AttributeError: If risk thresholds are not configured in ModelConfig.
        """
        # Validate input probabilities
        if not isinstance(probabilities, np.ndarray):
            raise ValueError("Probabilities must be a NumPy array")
        if not np.isclose(probabilities.sum(), 1, rtol=0.01):
            raise ValueError(f"Probabilities must sum to ~1.0, but got {probabilities.sum():.4f}")
        if len(probabilities) != len(self.label_encoder.classes_):
            raise ValueError(f"Probability count ({len(probabilities)}) must match number of risk classes ({len(self.label_encoder.classes_)})")

        try:
            max_prob_idx = np.argmax(probabilities)
            max_prob = probabilities[max_prob_idx]
            predicted_risk_category = self.label_encoder.classes_[max_prob_idx]

            # Check thresholds exist in config
            if not hasattr(self.config, 'high_risk_threshold'):
                raise AttributeError("Missing high_risk_threshold in config")
            if not hasattr(self.config, 'mid_risk_threshold'): # Corrected from medium_risk_threshold
                raise AttributeError("Missing mid_risk_threshold in config")
            if not hasattr(self.config, 'low_risk_confidence'):
                raise AttributeError("Missing low_risk_confidence in config")

            # Generate alerts based on thresholds
            if (max_prob_idx == self.high_risk_idx and
                max_prob >= self.config.high_risk_threshold):
                return {
                    'level': 'HIGH_ALERT',
                    'message': 'Immediate clinical evaluation recommended.',
                    'urgency': 'CRITICAL',
                    'risk_score': float(max_prob),
                    'risk_category': predicted_risk_category
                }
            elif (max_prob_idx == self.mid_risk_idx and
                  max_prob >= self.config.mid_risk_threshold):
                return {
                    'level': 'MEDIUM_ALERT',
                    'message': 'Clinical follow-up recommended.',
                    'urgency': 'MODERATE',
                    'risk_score': float(max_prob),
                    'risk_category': predicted_risk_category
                }
            elif (max_prob_idx == self.low_risk_idx and
                  max_prob >= self.config.low_risk_confidence): # High confidence in low risk
                 return {
                    'level': 'LOW_ALERT',
                    'message': 'Continue regular monitoring. Low risk confirmed.',
                    'urgency': 'LOW',
                    'risk_score': float(max_prob),
                    'risk_category': predicted_risk_category
                }
            else: # Default for cases not meeting specific high/mid/low confidence thresholds
                return {
                    'level': 'NO_SPECIFIC_ALERT',
                    'message': 'Risk level determined, but no specific alert threshold met.',
                    'urgency': 'LOW',
                    'risk_score': float(max_prob),
                    'risk_category': predicted_risk_category
                }

        except Exception as e:
            self.logger.error(f"Alert generation failed: {str(e)}", exc_info=True)
            return {
                'level': 'ERROR',
                'message': 'Unable to determine risk level due to internal error.',
                'urgency': 'UNKNOWN',
                'risk_score': 0.0,
                'risk_category': 'ERROR'
            }

    def _validate_input(self, X: pd.DataFrame):
        """
        Performs comprehensive input validation for prediction.

        Checks for:
        - Presence of required columns.
        - Absence of null values in required columns.
        - Values outside defined clinical ranges (logs warnings).

        Args:
            X (pd.DataFrame): The input DataFrame for prediction.

        Raises:
            ValueError: If required columns are missing or contain null values.
        """
        required_cols = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']

        # 1. Check for required columns
        missing_cols = [col for col in required_cols if col not in X.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns for prediction: {missing_cols}")

        # 2. Check for null values in required columns
        null_cols = X[required_cols].isnull().any()
        if null_cols.any():
            null_column_names = null_cols[null_cols].index.tolist()
            raise ValueError(f"Null values found in required columns: {null_column_names}")

        # 3. Validate clinical ranges (log warnings, don't raise error to allow prediction)
        for col, (min_val, max_val) in self.config.clinical_ranges.items():
            if col in X.columns:
                out_of_range = ((X[col] < min_val) | (X[col] > max_val)).any()
                if out_of_range:
                    self.logger.warning(f"Values outside clinical range detected for '{col}' in input data. Expected range: [{min_val}, {max_val}]")

    def predict(self, X: Union[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        Makes predictions for maternal risk levels with comprehensive validation and logging.

        Args:
            X (Union[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]]):
                Input data for prediction. Can be a pandas DataFrame, a single dictionary,
                or a list of dictionaries.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries, each containing prediction details
                                   for a single input sample.
        """
        self.logger.info(f"Received {len(X) if isinstance(X, (pd.DataFrame, list)) else 1} samples for prediction")

        # Ensure input is a DataFrame
        if isinstance(X, dict):
            X = pd.DataFrame([X])
        elif isinstance(X, list):
            X = pd.DataFrame(X)
        elif not isinstance(X, pd.DataFrame):
            raise TypeError("Input data must be a pandas DataFrame, a dictionary, or a list of dictionaries.")

        # Validate input data
        try:
            self._validate_input(X)
            self.logger.debug("Input validation successful.")
        except ValueError as e:
            self.logger.error(f"Input validation failed: {e}")
            raise

        # Transform data (feature engineering and scaling)
        try:
            self.logger.debug("Starting feature engineering.")
            X_engineered = self.feature_engineer.transform(X)
            self.logger.debug(f"Feature engineering completed. New shape: {X_engineered.shape}")

            self.logger.debug("Starting scaling.")
            # Ensure the order of columns is consistent with training
            # This is crucial if feature_engineer.get_feature_names_out() is used
            # and the scaler was fitted on a specific column order.
            # For simplicity, assuming scaler handles column order implicitly or
            # X_engineered columns are in the same order as X_train_engineered.
            # A more robust approach might involve a ColumnTransformer or explicit column reordering.
            X_scaled = self.scaler.transform(X_engineered)
            self.logger.debug(f"Scaling completed. New shape: {X_scaled.shape}")
        except Exception as e:
            self.logger.error(f"Data transformation failed: {e}")
            raise

        # Make predictions
        try:
            self.logger.debug("Starting model prediction.")
            y_pred = self.model.predict(X_scaled)
            y_proba = self.model.predict_proba(X_scaled)
            risk_labels = self.label_encoder.inverse_transform(y_pred)
            self.logger.debug("Model prediction completed.")
        except Exception as e:
            self.logger.error(f"Model prediction failed: {e}")
            raise

        # Format results for each sample
        results = []
        for i in range(len(X)):
            alert_info = self._generate_alert(y_proba[i])
            result = {
                'predicted_risk_level': risk_labels[i],
                'probability': {
                    self.label_encoder.classes_[j]: float(y_proba[i, j])
                    for j in range(len(self.label_encoder.classes_))
                },
                'alert': alert_info, # Now returns a dict
                'confidence_score': float(np.max(y_proba[i])),
                'timestamp': datetime.now().isoformat(),
                'model_version': getattr(self, 'version', '1.0.0')
            }
            results.append(result)

        self.logger.info(f"Predictions completed successfully for {len(X)} samples")
        return results

