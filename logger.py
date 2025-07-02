# maternal_health_project/logger.py

import logging
from datetime import datetime
from pathlib import Path
from config import ModelConfig # Import ModelConfig from config.py

class ProductionLogger:
    """Production-ready logging setup"""

    def __init__(self, config: ModelConfig, service_name: str = "maternal_risk_model"):
        self.config = config
        self.service_name = service_name
        self.setup_logging()

    def setup_logging(self):
        """Setup structured logging for production"""
        # Create logs directory
        Path(self.config.log_dir).mkdir(parents=True, exist_ok=True)

        # Setup logger
        self.logger = logging.getLogger(self.service_name)
        self.logger.setLevel(logging.INFO)

        # Clear existing handlers to prevent duplicate logs
        if self.logger.handlers:
            for handler in self.logger.handlers[:]:
                self.logger.removeHandler(handler)

        # File handler
        log_file = Path(self.config.log_dir) / f"{self.service_name}_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.INFO)

        # Console handler (for warnings and errors to stdout/stderr)
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.WARNING) # Only show WARNING and above on console

        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        # Add handlers
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def get_logger(self) -> logging.Logger:
        """Returns the configured logger instance."""
        return self.logger

