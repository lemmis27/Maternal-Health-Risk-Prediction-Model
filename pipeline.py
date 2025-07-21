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

# Try to import SHAP with error handling
try:
    import shap
except ImportError as e:
    shap = None

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
        # SHAP explainer (TreeExplainer for tree-based models, KernelExplainer fallback)
        self.shap_explainer = None
        if hasattr(self.model, 'predict_proba') and shap is not None:
            try:
                self.shap_explainer = shap.TreeExplainer(self.model)
            except Exception as e:
                self.logger.warning(f"TreeExplainer not supported: {e}. Falling back to KernelExplainer (may be slow).")
                try:
                    # Always use zeros as background for KernelExplainer fallback
                    mean_ = getattr(self.scaler, 'mean_', None)
                    if isinstance(mean_, np.ndarray):
                        background = np.zeros((1, mean_.shape[0]))
                    else:
                        background = np.zeros((1, 6))
                    self.shap_explainer = shap.KernelExplainer(self.model.predict_proba, background)
                except Exception as ke:
                    self.logger.warning(f"Could not initialize KernelExplainer: {ke}")
                    self.shap_explainer = None

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
    def load_model(cls, model_path: str, logger: logging.Logger = None):
        import joblib
        pipeline = joblib.load(model_path)
        # Patch: re-initialize shap_explainer after loading
        if shap is not None:
            try:
                pipeline.shap_explainer = shap.TreeExplainer(pipeline.model)
            except Exception as e:
                if logger:
                    logger.warning(f"TreeExplainer not supported: {e}. Falling back to KernelExplainer (may be slow).")
                try:
                    mean_ = getattr(pipeline.scaler, 'mean_', None)
                    if isinstance(mean_, np.ndarray):
                        background = np.zeros((1, mean_.shape[0]))
                    else:
                        background = np.zeros((1, 6))
                    pipeline.shap_explainer = shap.KernelExplainer(pipeline.model.predict_proba, background)
                except Exception as ke:
                    if logger:
                        logger.warning(f"Could not initialize KernelExplainer: {ke}")
                    pipeline.shap_explainer = None
        else:
            pipeline.shap_explainer = None
        return pipeline

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

    def predict(self, X: Union[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]], suppress_log: bool = False) -> List[Dict[str, Any]]:
        """
        Makes predictions for maternal risk levels with comprehensive validation and logging.

        Args:
            X (Union[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]]):
                Input data for prediction. Can be a pandas DataFrame, a single dictionary,
                or a list of dictionaries.
            suppress_log (bool): If True, suppresses the info log for batch size. Default is False.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries, each containing prediction details
                                   for a single input sample.
        """
        if not suppress_log:
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
        # Compute SHAP values if explainer is available
        shap_values = None
        try:
            if self.shap_explainer is not None:
                # Use engineered and scaled features for SHAP
                if hasattr(self.shap_explainer, 'shap_values'):
                    shap_values = self.shap_explainer.shap_values(X_engineered)
                else:
                    # KernelExplainer: returns array of shape (n_samples, n_features, n_classes) or (n_samples, n_features) for binary
                    shap_values = self.shap_explainer.shap_values(X_engineered)
        except Exception as e:
            self.logger.warning(f"SHAP value computation failed: {e}")
            shap_values = None
        for i in range(len(X)):
            alert_info = self._generate_alert(y_proba[i])
            explanation = []
            sample_shap = None
            if shap_values is not None:
                class_idx = np.argmax(y_proba[i])
                feature_names = []
                if hasattr(X_engineered, 'columns') and X_engineered.columns is not None:
                    feature_names = X_engineered.columns
                elif hasattr(X_engineered, 'shape') and isinstance(X_engineered.shape, tuple) and len(X_engineered.shape) > 1 and X_engineered.shape[1] > 0:
                    feature_names = [f'f{j}' for j in range(X_engineered.shape[1])]
                
                # Handle different SHAP value formats
                if isinstance(shap_values, list):
                    if len(shap_values) > class_idx and hasattr(shap_values[class_idx], '__getitem__'):
                        sample_shap = shap_values[class_idx][i]
                elif isinstance(shap_values, np.ndarray):
                    if shap_values.ndim == 3 and shap_values.shape[2] > class_idx:
                        sample_shap = shap_values[i, :, class_idx]
                    elif shap_values.ndim == 2:
                        sample_shap = shap_values[i]
                    elif shap_values.ndim == 1:
                        sample_shap = shap_values
                
                # Process SHAP values safely
                if sample_shap is not None and hasattr(sample_shap, '__iter__') and feature_names is not None and len(feature_names) > 0:
                    try:
                        # Ensure sample_shap is a 1D array
                        if hasattr(sample_shap, 'flatten'):
                            sample_shap = sample_shap.flatten()
                        
                        # Get top features by absolute SHAP value
                        if len(sample_shap) >= len(feature_names):
                            top_idx = np.argsort(np.abs(sample_shap))[::-1][:3]
                            explanation = []
                            for j in top_idx:
                                if j < len(feature_names):
                                    try:
                                        shap_value = float(sample_shap[j])
                                        explanation.append({
                                            "feature": feature_names[j], 
                                            "shap_value": shap_value
                                        })
                                    except (ValueError, TypeError) as e:
                                        self.logger.warning(f"Could not convert SHAP value to float: {e}")
                                        continue
                    except Exception as e:
                        self.logger.warning(f"Error processing SHAP values: {e}")
                        explanation = []
            
            result = {
                'predicted_risk_level': risk_labels[i],
                'probability': {
                    self.label_encoder.classes_[j]: float(y_proba[i, j])
                    for j in range(len(self.label_encoder.classes_))
                },
                'alert': alert_info, # Now returns a dict
                'confidence_score': float(np.max(y_proba[i])),
                'timestamp': datetime.now().isoformat(),
                'model_version': getattr(self, 'version', '1.0.0'),
                'explanation': explanation
            }
            results.append(result)

        self.logger.info(f"Predictions completed successfully for {len(X)} samples")
        return results

