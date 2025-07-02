# Maternal Health Risk Prediction Model

## Overview

This project develops a robust and production-ready machine learning pipeline designed to predict maternal health risk levels (low, mid, or high) based on key physiological parameters. Leveraging advanced data preprocessing, sophisticated feature engineering, and an ensemble of calibrated models, this system aims to provide accurate risk assessments and generate actionable clinical alerts to support timely medical interventions.

The model is built with a focus on reliability, interpretability, and clinical utility, incorporating best practices for data validation, model calibration, and comprehensive logging.

## Features

*   **Data Ingestion & Validation:** Secure loading and rigorous validation of input data, including checks against clinical ranges.
*   **Advanced Feature Engineering:** Creation of clinically relevant and interaction features (e.g., Pulse Pressure, MAP, Age-SystolicBP interaction) to enhance model performance.
*   **Robust Preprocessing:** Outlier handling (clipping/removal) and data scaling.
*   **Ensemble Modeling:** Utilizes a calibrated XGBoost classifier within an ensemble for improved predictive accuracy and reliability.
*   **Hyperparameter Tuning:** Employs `GridSearchCV` with `StratifiedKFold` for optimal model configuration.
*   **Imbalanced Data Handling:** Integrates SMOTE (Synthetic Minority Over-sampling Technique) within the pipeline to address class imbalance.
*   **Clinical Evaluation Metrics:** Beyond standard ML metrics, evaluates model performance based on a custom clinical cost function and calibration curves.
*   **Actionable Clinical Alerts:** Generates specific alerts (HIGH_ALERT, MEDIUM_ALERT, LOW_ALERT) with clinical recommendations and urgency levels based on predicted probabilities.
*   **Production-Ready Design:** Structured with dedicated modules for configuration, logging, and a deployable prediction pipeline, saved securely using `joblib`.
*   **Comprehensive Logging:** Detailed, structured logging for training, prediction, and error handling.

## Project Structure
