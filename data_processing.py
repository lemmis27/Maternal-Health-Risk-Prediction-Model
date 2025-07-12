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
    rows_before = len(df_processed)
    rows_removed = 0
    capped_counts = {col: 0 for col in columns}

    # Define which features to strictly remove and which to cap
    strict_remove = ['SystolicBP', 'DiastolicBP', 'BodyTemp', 'HeartRate']
    cap_features = ['Age', 'BS']

    # First, cap less critical features
    for col in columns:
        if config and col in config.clinical_ranges and col in cap_features:
            min_val, max_val = config.clinical_ranges[col]
            before = df_processed[col].copy()
            df_processed[col] = df_processed[col].clip(min_val, max_val)
            capped_counts[col] = (before != df_processed[col]).sum()
            if capped_counts[col] > 0 and logger:
                logger.info(f"Capped {capped_counts[col]} values in '{col}' to clinical range [{min_val}, {max_val}]")

    # Then, strictly remove rows for critical features
    for col in columns:
        if config and col in config.clinical_ranges and col in strict_remove:
            min_val, max_val = config.clinical_ranges[col]
            out_of_range_mask = (df_processed[col] < min_val) | (df_processed[col] > max_val)
            count_out = out_of_range_mask.sum()
            if count_out > 0 and logger:
                logger.warning(f"Removing {count_out} rows with out-of-range '{col}' (outside [{min_val}, {max_val}])")
            df_processed = df_processed[~out_of_range_mask]
            rows_removed += count_out

    logger.info(f"Total rows removed due to critical out-of-range values: {rows_before - len(df_processed)}")
    logger.info(f"Total values capped: {sum(capped_counts.values())}")
    return df_processed

