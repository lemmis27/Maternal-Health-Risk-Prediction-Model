# maternal_health_project/logger.py

import logging
import os
from datetime import datetime
from pathlib import Path
from config import ModelConfig # Import ModelConfig from config.py

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

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

# --- Audit Logger ---
auditor = logging.getLogger("audit")
if not auditor.handlers:
    audit_handler = logging.FileHandler("logs/audit.log")
    audit_handler.setFormatter(logging.Formatter("%(message)s"))
    auditor.addHandler(audit_handler)
auditor.setLevel(logging.INFO)

# --- Security Logger ---
security_logger = logging.getLogger("security")
if not security_logger.handlers:
    security_handler = logging.FileHandler("logs/security.log")
    security_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    security_logger.addHandler(security_handler)
security_logger.setLevel(logging.INFO)

def log_audit(user: str, role: str, ip: str, endpoint: str, action: str, resource_id: str = "-"):
    auditor.info(
        f"{datetime.now().isoformat()} | user={user} | role={role} | ip={ip} | endpoint={endpoint} | action={action} | resource={resource_id}"
    )

def log_security_event(event_type: str, user: str = "-", ip: str = "-", details: str = ""):
    """Log security events like failed logins, suspicious activities, etc."""
    security_logger.warning(
        f"SECURITY_EVENT | type={event_type} | user={user} | ip={ip} | details={details}"
    )

def log_failed_login(username: str, ip: str, reason: str = "Invalid credentials"):
    """Log failed login attempts for security monitoring."""
    log_security_event("failed_login", username, ip, reason)

def log_suspicious_activity(user: str, ip: str, activity: str):
    """Log suspicious activities for investigation."""
    log_security_event("suspicious_activity", user, ip, activity)

def log_access_violation(user: str, ip: str, resource: str, attempted_action: str):
    """Log access violations for security monitoring."""
    log_security_event("access_violation", user, ip, f"resource={resource} action={attempted_action}")

def log_rate_limit_exceeded(user: str, ip: str, endpoint: str):
    """Log rate limit violations."""
    log_security_event("rate_limit_exceeded", user, ip, f"endpoint={endpoint}")

