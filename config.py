# maternal_health_project/config.py

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

@dataclass
class ModelConfig:
    """Configuration class for maternal risk model"""
    # Data paths
    data_file: str = "data/Maternal Health Risk Data Set.csv"
    model_output_dir: str = "models"
    log_dir: str = "logs"

    # Model parameters
    test_size: float = 0.3
    random_state: int = 42
    cross_validation_folds: int = 5

    # Risk thresholds for alert generation
    high_risk_threshold: float = 0.7
    mid_risk_threshold: float = 0.4
    low_risk_confidence: float = 0.9

    # Clinical ranges for validation
    clinical_ranges: Dict[str, Tuple[float, float]] = None

    # Risk costs for clinical evaluation
    risk_costs: Dict[str, float] = None

    def __post_init__(self):
        """Initialize default clinical ranges and risk costs if not provided."""
        if self.clinical_ranges is None:
            self.clinical_ranges = {
                'Age': (13, 60),
                'SystolicBP': (70, 200),
                'DiastolicBP': (40, 120),
                'BS': (1, 30),
                'BodyTemp': (95, 104),
                'HeartRate': (40, 200)
            }

        if self.risk_costs is None:
            self.risk_costs = {
                'false_negative_high': 10,
                'false_positive_high': 3,
                'false_negative_mid': 5,
                'false_positive_mid': 2,
                'false_negative_low': 1,
                'false_positive_low': 1
            }

def load_config(config_path: Optional[str] = None) -> ModelConfig:
    """
    Loads configuration from a JSON file or returns default ModelConfig.

    Args:
        config_path (Optional[str]): Path to the JSON configuration file.

    Returns:
        ModelConfig: An instance of ModelConfig with loaded or default values.
    """
    import json
    import warnings
    from pathlib import Path

    if config_path and Path(config_path).exists():
        try:
            with open(config_path, 'r') as f:
                config_dict = json.load(f)
            return ModelConfig(**config_dict)
        except Exception as e:
            warnings.warn(f"Failed to load config from {config_path}: {e}. Using defaults.")
    return ModelConfig()

