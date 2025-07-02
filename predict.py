# maternal_health_project/predict.py

import pandas as pd
import logging
from pathlib import Path
from typing import Dict, Any, List # Added List here

from config import load_config, ModelConfig # <--- ADDED ModelConfig import here
from logger import ProductionLogger
from pipeline import MaternalRiskPipeline # Import the pipeline class

def make_prediction(input_data: Dict[str, Any], config: ModelConfig, logger: logging.Logger) -> List[Dict[str, Any]]:
    """
    Loads the trained model and makes a prediction for the given input data.

    Args:
        input_data (Dict[str, Any]): A dictionary containing the input features for prediction.
                                     Example: {'Age': 35, 'SystolicBP': 120, 'DiastolicBP': 80,
                                               'BS': 6.1, 'BodyTemp': 98.6, 'HeartRate': 70}
        config (ModelConfig): The configuration object.
        logger (logging.Logger): The logger instance.

    Returns:
        List[Dict[str, Any]]: A list of prediction results.

    Raises:
        Exception: If model loading or prediction fails.
    """
    model_path = Path(config.model_output_dir) / "maternal_risk_pipeline.joblib"

    try:
        # Load the model
        pipeline = MaternalRiskPipeline.load_model(str(model_path), logger)
        logger.info("Model loaded successfully for prediction.")

        # Convert input data to DataFrame (pipeline expects DataFrame)
        df_input = pd.DataFrame([input_data])

        # Make predictions
        predictions = pipeline.predict(df_input)
        logger.info(f"Prediction made for input: {input_data}")
        return predictions

    except FileNotFoundError:
        logger.error(f"Model file not found at {model_path}. Please ensure the model is trained and saved.")
        raise
    except Exception as e:
        logger.error(f"An error occurred during prediction: {e}", exc_info=True)
        raise

if __name__ == "__main__":
    # Load configuration
    config = load_config()

    # Setup logging
    logger_setup = ProductionLogger(config)
    logger = logger_setup.get_logger()

    # Example input data (must match training features)
    # You can modify this dictionary to test different scenarios
    sample_input = {
        'Age': 35,
        'SystolicBP': 120,
        'DiastolicBP': 80,
        'BS': 6.1,
        'BodyTemp': 98.6,
        'HeartRate': 70
    }

    try:
        print(f"Attempting prediction for input: {sample_input}")
        predictions = make_prediction(sample_input, config, logger)
        print("\n✅ Prediction successful!")
        print("Predictions:", predictions)

        # Another example for high risk
        high_risk_sample = {
            'Age': 45,
            'SystolicBP': 160,
            'DiastolicBP': 100,
            'BS': 15.0,
            'BodyTemp': 101.5,
            'HeartRate': 110
        }
        print(f"\nAttempting prediction for high risk input: {high_risk_sample}")
        high_risk_predictions = make_prediction(high_risk_sample, config, logger)
        print("\n✅ High risk prediction successful!")
        print("High Risk Predictions:", high_risk_predictions)


    except Exception as e:
        logger.critical(f"Prediction script terminated due to critical error: {e}")
        print(f"\n❌ Prediction failed: {e}")
        import sys
        sys.exit(1)

