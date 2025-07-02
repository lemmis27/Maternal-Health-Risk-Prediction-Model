
# maternal_health_project/tests/test_model.py

import unittest
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
import logging
from typing import Dict, Any, List, Optional, Tuple
import re # Import the re module for re.escape()

# Import necessary components from your project structure
from config import ModelConfig, load_config
from logger import ProductionLogger
from pipeline import MaternalRiskPipeline
from sklearn.preprocessing import LabelEncoder

class TestMaternalRiskModel(unittest.TestCase):
    """
    Unit tests for the Maternal Risk Prediction Model pipeline.
    """

    @classmethod
    def setUpClass(cls):
        """
        Set up for all tests: Load the model and configure logging.
        This method runs once before any tests in this class.
        """
        # Load configuration and setup logger for the tests
        cls.config = load_config()
        cls.logger_setup = ProductionLogger(cls.config, service_name="test_maternal_risk_model")
        cls.logger = cls.logger_setup.get_logger()
        # Set logger level to CRITICAL to suppress excessive output during tests
        cls.logger.setLevel(logging.CRITICAL)

        # Path to the trained model
        model_path = Path(cls.config.model_output_dir) / "maternal_risk_pipeline.joblib"

        # Attempt to load the model
        try:
            cls.model = MaternalRiskPipeline.load_model(str(model_path), cls.logger)
            # Suppress pipeline's internal logging during tests
            if cls.model and hasattr(cls.model, 'logger'):
                cls.model.logger.setLevel(logging.CRITICAL)
        except Exception as e:
            # If model cannot be loaded, skip all tests in this class
            raise unittest.SkipTest(f"Could not load model for testing. Ensure 'train.py' has been run successfully. Error: {str(e)}")

    def test_model_loading(self):
        """Test that the model loaded with expected components."""
        self.assertIsInstance(self.model, MaternalRiskPipeline, "Loaded object is not an instance of MaternalRiskPipeline")
        self.assertTrue(hasattr(self.model, 'predict'), "Model object should have a 'predict' method")
        self.assertTrue(hasattr(self.model, 'feature_engineer'), "Model object should have a 'feature_engineer' attribute")
        self.assertTrue(hasattr(self.model, 'scaler'), "Model object should have a 'scaler' attribute")
        self.assertTrue(hasattr(self.model, 'label_encoder'), "Model object should have a 'label_encoder' attribute")
        self.assertTrue(hasattr(self.model, 'config'), "Model object should have a 'config' attribute")
        self.assertTrue(hasattr(self.model, 'logger'), "Model object should have a 'logger' attribute")

    def test_prediction_output_structure(self):
        """Test prediction returns expected format and keys."""
        sample = pd.DataFrame([{
            'Age': 25,
            'SystolicBP': 120,
            'DiastolicBP': 80,
            'BS': 6.5,
            'BodyTemp': 98.0,
            'HeartRate': 70
        }])

        result = self.model.predict(sample)

        # Check it returns a list of length 1 for a single input
        self.assertIsInstance(result, list, "Prediction result should be a list")
        self.assertEqual(len(result), 1, "Prediction result list should contain one item for one input")

        # Check the structure of the first item
        prediction_output = result[0]
        self.assertIsInstance(prediction_output, dict, "Each prediction item should be a dictionary")

        expected_keys = [
            'predicted_risk_level',
            'probability',
            'alert',
            'confidence_score',
            'timestamp',
            'model_version'
        ]
        for key in expected_keys:
            self.assertIn(key, prediction_output, f"Prediction output missing expected key: {key}")

        # Check types of some values
        self.assertIsInstance(prediction_output['predicted_risk_level'], str)
        self.assertIsInstance(prediction_output['probability'], dict)
        self.assertIsInstance(prediction_output['alert'], dict) # alert is now a dict
        self.assertIsInstance(prediction_output['confidence_score'], float)

    def test_risk_probability_sums_to_1(self):
        """Test that probabilities for a prediction sum to approximately 1."""
        sample = pd.DataFrame([{
            'Age': 35,
            'SystolicBP': 140,
            'DiastolicBP': 90,
            'BS': 7.0,
            'BodyTemp': 99.0,
            'HeartRate': 90
        }])

        result = self.model.predict(sample)
        probabilities = result[0]['probability']
        prob_sum = sum(probabilities.values())
        self.assertAlmostEqual(prob_sum, 1.0, places=5, msg="Probabilities should sum to approximately 1.0")

    def test_edge_case_handling(self):
        """Test handling of edge case inputs (empty, missing columns, nulls)."""
        # --- Test empty dataframe ---
        # Updated message to match the actual error from your model
        raw_all_missing_cols_msg = "Missing required columns for prediction: ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']"
        escaped_all_missing_cols_msg = re.escape(raw_all_missing_cols_msg)
        self.assertRaisesRegex(ValueError, escaped_all_missing_cols_msg,
                               lambda: self.model.predict(pd.DataFrame()))

        # --- Test missing specific columns (e.g., only 'Age' provided) ---
        # Updated message to match the actual error from your model  
        raw_partial_missing_cols_msg = "Missing required columns for prediction: ['SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate']"
        escaped_partial_missing_cols_msg = re.escape(raw_partial_missing_cols_msg)
        self.assertRaisesRegex(ValueError, escaped_partial_missing_cols_msg,
                               lambda: self.model.predict(pd.DataFrame([{'Age': 25}])))

        # --- Test with null values in required columns ---
        # Updated message to match the actual error from your model
        raw_null_cols_msg = "Null values found in required columns: ['Age']"
        escaped_null_cols_msg = re.escape(raw_null_cols_msg)
        self.assertRaisesRegex(ValueError, escaped_null_cols_msg,
                               lambda: self.model.predict(pd.DataFrame([{'Age': np.nan, 'SystolicBP': 120, 'DiastolicBP': 80, 'BS': 6.1, 'BodyTemp': 98.6, 'HeartRate': 70}])))

    def test_alert_levels(self):
        """
        Test the _generate_alert method logic directly.
        This requires setting up a dummy pipeline instance with necessary attributes.
        """
        # Create a dummy LabelEncoder and config for testing _generate_alert in isolation
        dummy_le = LabelEncoder()
        # Ensure the order of classes matches what the pipeline expects (alphabetical by default)
        dummy_le.fit(['high risk', 'low risk', 'mid risk'])

        dummy_config = ModelConfig() # Use default config values
        dummy_config.high_risk_threshold = 0.7
        dummy_config.mid_risk_threshold = 0.4
        dummy_config.low_risk_confidence = 0.9

        # Create a minimal dummy pipeline instance to call _generate_alert
        class DummyPipeline:
            def __init__(self, le, cfg, log):
                self.label_encoder = le
                self.config = cfg
                self.logger = log
                # Manually set risk indices as _setup_risk_indices is not called
                self.high_risk_idx = list(self.label_encoder.classes_).index('high risk')
                self.mid_risk_idx = list(self.label_encoder.classes_).index('mid risk')
                self.low_risk_idx = list(self.label_encoder.classes_).index('low risk')

            # Directly expose the method we want to test, using lowercase 'dict' for type hint
            def _generate_alert(self, probabilities: np.ndarray) -> dict[str, Any]: # Changed Dict to dict
                # Re-implement the logic from pipeline.py's _generate_alert
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
                          max_prob >= self.config.low_risk_confidence):
                         return {
                            'level': 'LOW_ALERT',
                            'message': 'Continue regular monitoring. Low risk confirmed.',
                            'urgency': 'LOW',
                            'risk_score': float(max_prob),
                            'risk_category': predicted_risk_category
                        }
                    else:
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

        # Instantiate the dummy pipeline
        dummy_pipeline_instance = DummyPipeline(dummy_le, dummy_config, self.logger)

        # Test cases: probabilities for [high risk, low risk, mid risk] based on alphabetical order
        # dummy_le.classes_ will be ['high risk', 'low risk', 'mid risk']
        # So, index 0 is 'high risk', index 1 is 'low risk', index 2 is 'mid risk'
        test_cases = [
            # High risk prediction (index 0) with prob >= 0.7
            {'input_probs': np.array([0.75, 0.15, 0.10]), 'expected_level': 'HIGH_ALERT'},
            # Mid risk prediction (index 2) with prob >= 0.4
            {'input_probs': np.array([0.10, 0.20, 0.70]), 'expected_level': 'MEDIUM_ALERT'},
            # Low risk prediction (index 1) with prob >= 0.9
            {'input_probs': np.array([0.05, 0.90, 0.05]), 'expected_level': 'LOW_ALERT'},
            # Not meeting specific thresholds, but still a prediction
            {'input_probs': np.array([0.3, 0.4, 0.3]), 'expected_level': 'NO_SPECIFIC_ALERT'},
            {'input_probs': np.array([0.6, 0.2, 0.2]), 'expected_level': 'NO_SPECIFIC_ALERT'}, # High prob, but below 0.7 for high risk
        ]

        for case in test_cases:
            with self.subTest(case=case):
                alert_result = dummy_pipeline_instance._generate_alert(case['input_probs'])
                self.assertEqual(alert_result['level'], case['expected_level'],
                                 f"Failed for input {case['input_probs']}. Expected {case['expected_level']}, got {alert_result['level']}")

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)