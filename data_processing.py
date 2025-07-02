# maternal_health_project/data_processing.py

import pandas as pd
import logging
from pathlib import Path
from typing import List, Optional
from config import ModelConfig # Import ModelConfig

def load_data(filepath: str, logger: logging.Logger) -> pd.DataFrame:
    """
    Loads and validates data from a CSV file.

    Args:
        filepath (str): The path to the CSV data file.
        logger (logging.Logger): The logger instance.

    Returns:
        pd.DataFrame: The loaded DataFrame.

    Raises:
        FileNotFoundError: If the data file does not exist.
        ValueError: If required columns are missing.
        Exception: For other errors during data loading.
    """
    if not Path(filepath).exists():
        raise FileNotFoundError(f"Data file not found at: {filepath}")

    try:
        logger.info(f"Loading data from {filepath}")
        df = pd.read_csv(filepath)

        # Validate required columns
        required_columns = ['Age', 'SystolicBP', 'DiastolicBP', 'BS', 'BodyTemp', 'HeartRate', 'RiskLevel']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        logger.info(f"Successfully loaded {len(df)} samples with {len(df.columns)} features")
        return df

    except Exception as e:
        logger.error(f"Error loading data from {filepath}: {str(e)}")
        raise

def handle_outliers(df: pd.DataFrame, columns: List[str], method: str = 'clip',
                   config: Optional[ModelConfig] = None, logger: Optional[logging.Logger] = None) -> pd.DataFrame:
    """
    Enhanced outlier handling with logging and optional clinical range check.

    Args:
        df (pd.DataFrame): The input DataFrame.
        columns (List[str]): A list of columns to check for outliers.
        method (str): The method to handle outliers ('clip' or 'remove').
                      'clip': Replaces outliers with the IQR bounds.
                      'remove': Removes rows containing outliers.
        config (Optional[ModelConfig]): Model configuration for clinical ranges.
        logger (Optional[logging.Logger]): The logger instance.

    Returns:
        pd.DataFrame: The DataFrame with outliers handled.
    """
    if logger is None:
        logger = logging.getLogger(__name__)

    df_processed = df.copy()
    outliers_handled = 0

    for col in columns:
        if col not in df_processed.columns:
            logger.warning(f"Column '{col}' not found for outlier handling")
            continue

        # Outlier detection using IQR
        Q1 = df_processed[col].quantile(0.25)
        Q3 = df_processed[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound_iqr = Q1 - 1.5 * IQR
        upper_bound_iqr = Q3 + 1.5 * IQR

        outliers_mask = (df_processed[col] < lower_bound_iqr) | (df_processed[col] > upper_bound_iqr)
        outliers_count = outliers_mask.sum()

        if outliers_count > 0:
            if method == 'clip':
                df_processed[col] = df_processed[col].clip(lower_bound_iqr, upper_bound_iqr)
                logger.info(f"Clipped {outliers_count} outliers in column '{col}' using IQR")
            elif method == 'remove':
                initial_rows = len(df_processed)
                df_processed = df_processed[~outliers_mask]
                logger.info(f"Removed {initial_rows - len(df_processed)} outlier rows for column '{col}' using IQR")

            outliers_handled += outliers_count

        # Clinical range check (optional)
        if config and col in config.clinical_ranges:
            min_val, max_val = config.clinical_ranges[col]
            clinical_out_of_range_mask = ((df_processed[col] < min_val) | (df_processed[col] > max_val))
            clinical_out_of_range_count = clinical_out_of_range_mask.sum()

            if clinical_out_of_range_count > 0:
                logger.warning(f"Detected {clinical_out_of_range_count} values outside clinical range for '{col}' after outlier handling")
                # Further handling (e.g., replace with NaN, specific imputation) could be added here if needed.

    logger.info(f"Total IQR outliers handled: {outliers_handled}")
    return df_processed

