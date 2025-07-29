# maternal_health_project/config.py

import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set for production.")

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    # Fallback to SQLite for local development
    SQLALCHEMY_DATABASE_URL = "sqlite:///./maternal_health.db"
    print("⚠️  Using SQLite database. Set DATABASE_URL for PostgreSQL.")
else:
    # Check if PostgreSQL dependencies are available
    try:
        import psycopg2
    except ImportError:
        print("⚠️  PostgreSQL driver not available, falling back to SQLite")
        SQLALCHEMY_DATABASE_URL = "sqlite:///./maternal_health.db"

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# Minimal stubs for test_model.py compatibility
class ModelConfig:
    def __init__(self):
        self.model_output_dir = "models"
        self.high_risk_threshold = 0.7
        self.mid_risk_threshold = 0.4
        self.low_risk_confidence = 0.9
        self.log_dir = "logs"
        self.data_file = os.getenv("DATA_FILE", "data/Maternal Health Risk Data Set.csv")
        self.clinical_ranges = {
            "Age": (15, 45),
            "SystolicBP": (80, 200),
            "DiastolicBP": (50, 130),
            "BS": (2.0, 20.0),
            "BodyTemp": (95.0, 104.0),
            "HeartRate": (40, 180)
        }
        self.test_size = 0.2
        self.random_state = 42
        self.cross_validation_folds = 5
        self.risk_costs = {
            'false_negative_high': 10,
            'false_positive_high': 3,
            'false_negative_mid': 5,
            'false_positive_mid': 2,
            'false_negative_low': 1,
            'false_positive_low': 1
        }

def load_config():
    return ModelConfig()

