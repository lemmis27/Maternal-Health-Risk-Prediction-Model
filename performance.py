"""
Performance monitoring utilities.
"""
import time
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

class PerformanceMonitor:
    """Monitors and tracks performance metrics."""
    
    def __init__(self):
        self.response_times = defaultdict(list)
        self.cache_hits = defaultdict(int)
        self.cache_misses = defaultdict(int)
        self.error_counts = defaultdict(int)
        self.start_time = datetime.now()
    
    def record_response_time(self, endpoint: str, duration: float):
        """Record response time for an endpoint."""
        self.response_times[endpoint].append(duration)
        # Keep only last 1000 measurements per endpoint
        if len(self.response_times[endpoint]) > 1000:
            self.response_times[endpoint] = self.response_times[endpoint][-1000:]
    
    def record_cache_hit(self, cache_type: str):
        """Record a cache hit."""
        self.cache_hits[cache_type] += 1
    
    def record_cache_miss(self, cache_type: str):
        """Record a cache miss."""
        self.cache_misses[cache_type] += 1
    
    def record_error(self, endpoint: str, error_type: str):
        """Record an error occurrence."""
        self.error_counts[f"{endpoint}:{error_type}"] += 1
    
    def get_endpoint_stats(self, endpoint: str) -> Dict[str, Any]:
        """Get performance stats for a specific endpoint."""
        times = self.response_times[endpoint]
        if not times:
            return {"count": 0, "avg_time": 0, "min_time": 0, "max_time": 0}
        
        return {
            "count": len(times),
            "avg_time": statistics.mean(times),
            "min_time": min(times),
            "max_time": max(times),
            "p95_time": statistics.quantiles(times, n=20)[-1] if len(times) >= 20 else max(times)
        }
    
    def get_cache_stats(self, cache_type: str) -> Dict[str, Any]:
        """Get cache statistics for a specific cache type."""
        hits = self.cache_hits[cache_type]
        misses = self.cache_misses[cache_type]
        total = hits + misses
        
        if total == 0:
            return {"hit_rate": 0, "hits": 0, "misses": 0, "total": 0}
        
        return {
            "hit_rate": hits / total,
            "hits": hits,
            "misses": misses,
            "total": total
        }
    
    def get_overall_stats(self) -> Dict[str, Any]:
        """Get overall performance statistics."""
        all_times = []
        for times in self.response_times.values():
            all_times.extend(times)
        
        total_errors = sum(self.error_counts.values())
        total_cache_hits = sum(self.cache_hits.values())
        total_cache_misses = sum(self.cache_misses.values())
        
        return {
            "uptime_seconds": (datetime.now() - self.start_time).total_seconds(),
            "total_requests": len(all_times),
            "avg_response_time": statistics.mean(all_times) if all_times else 0,
            "total_errors": total_errors,
            "total_cache_hits": total_cache_hits,
            "total_cache_misses": total_cache_misses,
            "overall_cache_hit_rate": total_cache_hits / (total_cache_hits + total_cache_misses) if (total_cache_hits + total_cache_misses) > 0 else 0
        }
    
    def get_endpoints_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary of all endpoints."""
        return {
            endpoint: self.get_endpoint_stats(endpoint)
            for endpoint in self.response_times.keys()
        }
    
    def get_cache_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary of all cache types."""
        cache_types = set(self.cache_hits.keys()) | set(self.cache_misses.keys())
        return {
            cache_type: self.get_cache_stats(cache_type)
            for cache_type in cache_types
        }

# Global performance monitor
performance_monitor = PerformanceMonitor()

def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance."""
    return performance_monitor

class PerformanceMiddleware:
    """Middleware to track performance metrics."""
    
    def __init__(self, app):
        self.app = app
        self.monitor = get_performance_monitor()
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        
        # Track the request
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                duration = time.time() - start_time
                endpoint = scope.get("path", "unknown")
                self.monitor.record_response_time(endpoint, duration)
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            endpoint = scope.get("path", "unknown")
            self.monitor.record_error(endpoint, type(e).__name__)
            raise

def track_performance(func):
    """Decorator to track performance of specific functions."""
    async def wrapper(*args, **kwargs):
        monitor = get_performance_monitor()
        start_time = time.time()
        
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            monitor.record_response_time(func.__name__, duration)
            return result
        except Exception as e:
            monitor.record_error(func.__name__, type(e).__name__)
            raise
    
    return wrapper 