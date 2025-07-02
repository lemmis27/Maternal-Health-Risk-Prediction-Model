# maternal_health_project/features.py

import pandas as pd
import logging
from typing import List, Optional
from sklearn.base import BaseEstimator, TransformerMixin

class FeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Enhanced feature engineering with validation and logging.
    Creates clinically relevant and interaction features.
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.required_features = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']
        self.engineered_feature_names = [
            'Age_SystolicBP', 'PulsePressure', 'MAP', 'HR_Temp_Ratio',
            'Age_BS', 'BP_Product', 'Age_squared', 'Temp_HR_interaction'
        ]

    def fit(self, X: pd.DataFrame, y=None):
        """
        Fits the feature engineer. In this case, it primarily validates input.

        Args:
            X (pd.DataFrame): Input data.
            y: Target variable (ignored).

        Returns:
            self: The fitted transformer.
        """
        self.logger.info("Fitting feature engineer")
        self._validate_input(X)
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms the input DataFrame by adding engineered features.

        Args:
            X (pd.DataFrame): Input data.

        Returns:
            pd.DataFrame: Transformed DataFrame with new features.
        """
        self.logger.debug(f"Transforming features for {len(X)} samples")
        self._validate_input(X)

        X_copy = X.copy()

        # Create clinically relevant features
        X_copy['Age_SystolicBP'] = X_copy['Age'] * X_copy['SystolicBP']
        X_copy['PulsePressure'] = X_copy['SystolicBP'] - X_copy['DiastolicBP']
        # Mean Arterial Pressure (MAP) calculation
        X_copy['MAP'] = X_copy['DiastolicBP'] + (X_copy['PulsePressure'] / 3)
        X_copy['HR_Temp_Ratio'] = X_copy['HeartRate'] / X_copy['BodyTemp']
        X_copy['Age_BS'] = X_copy['Age'] * X_copy['BS']

        # Add interaction features
        X_copy['BP_Product'] = X_copy['SystolicBP'] * X_copy['DiastolicBP']
        X_copy['Age_squared'] = X_copy['Age'] ** 2
        X_copy['Temp_HR_interaction'] = X_copy['BodyTemp'] * X_copy['HeartRate']

        self.logger.debug(f"Created {len(X_copy.columns) - len(X.columns)} new features")
        return X_copy

    def _validate_input(self, X: pd.DataFrame):
        """
        Validates if all required features are present in the input DataFrame.

        Args:
            X (pd.DataFrame): Input data.

        Raises:
            ValueError: If any required features are missing.
        """
        missing_features = [feat for feat in self.required_features if feat not in X.columns]
        if missing_features:
            raise ValueError(f"Missing required features for engineering: {missing_features}")

    def get_feature_names_out(self, input_features: Optional[List[str]] = None) -> List[str]:
        """
        Returns the names of all features after transformation.

        Args:
            input_features (Optional[List[str]]): List of input feature names.
                                                  If None, uses self.required_features.

        Returns:
            List[str]: A list of all feature names, including engineered ones.
        """
        if input_features is None:
            input_features = self.required_features
        return list(input_features) + self.engineered_feature_names

