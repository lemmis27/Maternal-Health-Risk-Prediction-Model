"""
Caching utilities for performance optimization.
"""
import json
import hashlib
import os
from typing import Optional, Any, Dict
from datetime import timedelta
import redis
from fastapi import HTTPException

# Redis connection with fallback
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    # Test the connection
    redis_client.ping()
    redis_available = True
except Exception as e:
    print(f"Redis not available: {e}")
    redis_client = None
    redis_available = False

class CacheManager:
    """Manages caching operations for the application."""
    
    def __init__(self):
        self.redis_client = redis_client
        self.redis_available = redis_available
        self.default_ttl = 3600  # 1 hour default
    
    def _generate_cache_key(self, prefix: str, data: Dict[str, Any]) -> str:
        """Generate a unique cache key based on data."""
        # Create a hash of the data for consistent key generation
        data_str = json.dumps(data, sort_keys=True)
        data_hash = hashlib.md5(data_str.encode()).hexdigest()
        return f"{prefix}:{data_hash}"
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        if not self.redis_available or not self.redis_client:
            return None
        try:
            value = self.redis_client.get(key)
            return json.loads(value) if value else None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = None) -> bool:
        """Set value in cache with optional TTL."""
        if not self.redis_available or not self.redis_client:
            return False
        try:
            ttl = ttl or self.default_ttl
            return self.redis_client.setex(key, ttl, json.dumps(value))
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from cache."""
        if not self.redis_available or not self.redis_client:
            return False
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False
    
    def cache_model_prediction(self, features: Dict[str, Any], prediction: Dict[str, Any], ttl: int = 1800) -> str:
        """Cache model prediction results."""
        cache_key = self._generate_cache_key("model_prediction", features)
        self.set(cache_key, prediction, ttl)
        return cache_key
    
    def get_cached_prediction(self, features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get cached model prediction."""
        cache_key = self._generate_cache_key("model_prediction", features)
        return self.get(cache_key)
    
    def cache_user_session(self, user_id: str, session_data: Dict[str, Any], ttl: int = 3600) -> str:
        """Cache user session data."""
        cache_key = f"user_session:{user_id}"
        self.set(cache_key, session_data, ttl)
        return cache_key
    
    def get_cached_session(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached user session."""
        cache_key = f"user_session:{user_id}"
        return self.get(cache_key)
    
    def cache_assessment_data(self, assessment_id: str, assessment_data: Dict[str, Any], ttl: int = 7200) -> str:
        """Cache assessment data."""
        cache_key = f"assessment:{assessment_id}"
        self.set(cache_key, assessment_data, ttl)
        return cache_key
    
    def get_cached_assessment(self, assessment_id: str) -> Optional[Dict[str, Any]]:
        """Get cached assessment data."""
        cache_key = f"assessment:{assessment_id}"
        return self.get(cache_key)
    
    def invalidate_user_cache(self, user_id: str):
        """Invalidate all cache entries for a user."""
        if not self.redis_available or not self.redis_client:
            return
        try:
            pattern = f"user_session:{user_id}"
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except Exception as e:
            print(f"Cache invalidation error: {e}")
    
    def health_check(self) -> bool:
        """Check if Redis is available."""
        return self.redis_available

# Global cache manager instance
cache_manager = CacheManager()

def get_cache_manager() -> CacheManager:
    """Get the global cache manager instance."""
    return cache_manager 