"""
Encryption utilities for sensitive data protection.
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional

class DataEncryption:
    """Handles encryption and decryption of sensitive data."""
    
    def __init__(self, encryption_key: Optional[str] = None):
        """Initialize encryption with a key or generate one."""
        if encryption_key:
            # Use provided key
            self.key = base64.urlsafe_b64encode(encryption_key.encode()[:32].ljust(32, b'0'))
        else:
            # Generate new key
            self.key = Fernet.generate_key()
        
        self.cipher_suite = Fernet(self.key)
    
    def encrypt(self, data: str) -> str:
        """Encrypt sensitive data."""
        if not data:
            return data
        try:
            encrypted_data = self.cipher_suite.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            print(f"Encryption error: {e}")
            return data  # Fallback to plain text
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        if not encrypted_data:
            return encrypted_data
        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = self.cipher_suite.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            print(f"Decryption error: {e}")
            return encrypted_data  # Fallback to encrypted text
    
    def get_key(self) -> str:
        """Get the encryption key for storage."""
        return self.key.decode()

# Global encryption instance
# In production, this should be loaded from environment variables
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "your-secret-encryption-key-here")
encryption = DataEncryption(ENCRYPTION_KEY)

def encrypt_sensitive_data(data: str) -> str:
    """Encrypt sensitive data like phone numbers, emergency contacts, etc."""
    return encryption.encrypt(data)

def decrypt_sensitive_data(encrypted_data: str) -> str:
    """Decrypt sensitive data."""
    return encryption.decrypt(encrypted_data) 