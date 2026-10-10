"""
Production-Grade Rate Limiting
==============================

Implements:
1. IP-based rate limiting
2. User-based rate limiting (for authenticated requests)
3. Endpoint-specific rate limits
4. Distributed rate limiting support (Redis-backed)
5. Custom rate limit strategies

WHY: Prevents abuse, DDoS attacks, brute-force attempts, and controls infrastructure costs.
"""

import os
import time
import logging
from functools import wraps
from flask import request, jsonify, g
from typing import Optional, Callable
import hashlib

logger = logging.getLogger('plant-care-backend')

# Rate Limit Configuration
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
RATE_LIMIT_STORAGE = os.getenv('RATE_LIMIT_STORAGE', 'memory')  # 'memory' or 'redis'
REDIS_URL = os.getenv('REDIS_URL', '')

# Default limits (requests per minute)
DEFAULT_IP_LIMIT = int(os.getenv('RATE_LIMIT_IP_REQUESTS_PER_MINUTE', 60))
DEFAULT_USER_LIMIT = int(os.getenv('RATE_LIMIT_USER_REQUESTS_PER_MINUTE', 100))
DEFAULT_ANONYMOUS_LIMIT = int(os.getenv('RATE_LIMIT_ANONYMOUS_REQUESTS_PER_MINUTE', 20))

# Storage for rate limit tracking
_rate_limit_storage = {}


class RateLimitExceeded(Exception):
    """Raised when rate limit is exceeded."""
    def __init__(self, message: str, retry_after: int):
        self.message = message
        self.retry_after = retry_after
        super().__init__(self.message)


class RateLimiter:
    """
    Sliding window rate limiter with memory or Redis backend.
    
    WHY: Provides accurate rate limiting using sliding window algorithm,
         preventing bursts of traffic while allowing normal usage patterns.
    """
    
    def __init__(self, storage_backend: str = 'memory'):
        self.backend = storage_backend
        self.storage = _rate_limit_storage
        
        if storage_backend == 'redis' and REDIS_URL:
            try:
                import redis
                self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
                logger.info("Rate limiter initialized with Redis backend")
            except ImportError:
                logger.warning("Redis not available, falling back to memory storage")
                self.backend = 'memory'
            except Exception as e:
                logger.error(f"Redis connection failed: {e}, falling back to memory storage")
                self.backend = 'memory'
    
    def _get_identifier(self) -> str:
        """
        Get unique identifier for rate limiting.
        Priority: User ID > IP Address
        
        WHY: Authenticated users get higher limits and are tracked by user_id,
             while anonymous users are tracked by IP to prevent abuse.
        """
        # If user is authenticated, use user_id
        if hasattr(g, 'user_id') and g.user_id:
            return f"user:{g.user_id}"
        
        # Fall back to IP address
        ip = self._get_client_ip()
        return f"ip:{ip}"
    
    def _get_client_ip(self) -> str:
        """
        Extract client IP, handling proxies and load balancers.
        
        WHY: Correctly identifies client IP even behind proxies/CDNs,
             preventing attackers from bypassing limits by using proxies.
        """
        # Check X-Forwarded-For header (set by proxies/load balancers)
        if request.headers.get('X-Forwarded-For'):
            # Take the first IP (client IP)
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        
        # Check X-Real-IP header (set by Nginx)
        if request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        
        # Fall back to direct connection IP
        return request.remote_addr or 'unknown'
    
    def _get_window_key(self, identifier: str, endpoint: str) -> str:
        """Generate storage key for rate limit window."""
        # Hash endpoint to keep key short
        endpoint_hash = hashlib.md5(endpoint.encode()).hexdigest()[:8]
        return f"ratelimit:{identifier}:{endpoint_hash}"
    
    def check_rate_limit(self, limit: int, window: int = 60, endpoint: Optional[str] = None) -> dict:
        """
        Check if request is within rate limit.
        
        Args:
            limit: Maximum requests allowed in window
            window: Time window in seconds (default: 60)
            endpoint: Optional endpoint identifier (defaults to current path)
        
        Returns:
            dict with limit info: {allowed, remaining, reset_at}
        
        Raises:
            RateLimitExceeded: If limit is exceeded
        """
        if not RATE_LIMIT_ENABLED:
            return {'allowed': True, 'remaining': limit, 'reset_at': 0}
        
        identifier = self._get_identifier()
        endpoint = endpoint or request.path
        key = self._get_window_key(identifier, endpoint)
        current_time = time.time()
        window_start = current_time - window
        
        if self.backend == 'redis':
            return self._check_redis_limit(key, limit, window, window_start, current_time)
        else:
            return self._check_memory_limit(key, limit, window, window_start, current_time)
    
    def _check_memory_limit(self, key: str, limit: int, window: int, 
                           window_start: float, current_time: float) -> dict:
        """Check rate limit using in-memory storage."""
        # Get or initialize request timestamps for this key
        if key not in self.storage:
            self.storage[key] = []
        
        # Remove timestamps outside the current window
        self.storage[key] = [ts for ts in self.storage[key] if ts > window_start]
        
        # Count requests in current window
        request_count = len(self.storage[key])
        
        # Check if limit exceeded
        if request_count >= limit:
            # Calculate when the oldest request will expire
            oldest_request = min(self.storage[key]) if self.storage[key] else current_time
            reset_at = int(oldest_request + window)
            retry_after = reset_at - int(current_time)
            
            raise RateLimitExceeded(
                f"Rate limit exceeded. Try again in {retry_after} seconds.",
                retry_after
            )
        
        # Add current request timestamp
        self.storage[key].append(current_time)
        
        # Calculate remaining requests and reset time
        remaining = limit - (request_count + 1)
        reset_at = int(current_time + window)
        
        return {
            'allowed': True,
            'remaining': remaining,
            'reset_at': reset_at
        }
    
    def _check_redis_limit(self, key: str, limit: int, window: int,
                          window_start: float, current_time: float) -> dict:
        """Check rate limit using Redis sorted sets."""
        try:
            # Use Redis sorted set with timestamps as scores
            # Remove old entries
            self.redis_client.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            request_count = self.redis_client.zcard(key)
            
            # Check if limit exceeded
            if request_count >= limit:
                # Get oldest request timestamp
                oldest = self.redis_client.zrange(key, 0, 0, withscores=True)
                oldest_ts = oldest[0][1] if oldest else current_time
                reset_at = int(oldest_ts + window)
                retry_after = reset_at - int(current_time)
                
                raise RateLimitExceeded(
                    f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    retry_after
                )
            
            # Add current request
            self.redis_client.zadd(key, {str(current_time): current_time})
            
            # Set expiration on key
            self.redis_client.expire(key, window * 2)
            
            remaining = limit - (request_count + 1)
            reset_at = int(current_time + window)
            
            return {
                'allowed': True,
                'remaining': remaining,
                'reset_at': reset_at
            }
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {e}")
            # Fail open - allow request if Redis is down
            return {'allowed': True, 'remaining': limit, 'reset_at': 0}


# Global rate limiter instance
_limiter = RateLimiter(storage_backend=RATE_LIMIT_STORAGE)


def rate_limit(limit: Optional[int] = None, window: int = 60, per: str = 'ip'):
    """
    Decorator to apply rate limiting to endpoints.
    
    Usage:
        @app.route('/api/search')
        @rate_limit(limit=10, window=60)  # 10 requests per minute
        def search():
            return jsonify({'results': []})
        
        @app.route('/api/analyze')
        @rate_limit(limit=5, window=300)  # 5 requests per 5 minutes
        def analyze():
            return jsonify({'status': 'processing'})
    
    Args:
        limit: Max requests per window (None = use defaults)
        window: Time window in seconds (default: 60)
        per: Rate limit per 'ip' or 'user' (default: 'ip')
    
    WHY: Prevents abuse by limiting request frequency per endpoint.
         Different endpoints can have different limits based on cost/complexity.
    """
    def decorator(f: Callable):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Determine appropriate limit
            effective_limit = limit
            if effective_limit is None:
                if hasattr(g, 'user_id') and g.user_id:
                    effective_limit = DEFAULT_USER_LIMIT
                else:
                    effective_limit = DEFAULT_ANONYMOUS_LIMIT
            
            try:
                # Check rate limit
                limit_info = _limiter.check_rate_limit(
                    limit=effective_limit,
                    window=window,
                    endpoint=request.path
                )
                
                # Add rate limit headers to response
                response = f(*args, **kwargs)
                
                # If response is a tuple, extract the response object
                if isinstance(response, tuple):
                    response_obj = response[0]
                else:
                    response_obj = response
                
                # Add rate limit headers
                if hasattr(response_obj, 'headers'):
                    response_obj.headers['X-RateLimit-Limit'] = str(effective_limit)
                    response_obj.headers['X-RateLimit-Remaining'] = str(limit_info['remaining'])
                    response_obj.headers['X-RateLimit-Reset'] = str(limit_info['reset_at'])
                
                return response
                
            except RateLimitExceeded as e:
                logger.warning(
                    f"Rate limit exceeded for {_limiter._get_identifier()} "
                    f"on {request.path} (limit: {effective_limit}/{window}s)"
                )
                
                # Return 429 with retry information
                response = jsonify({
                    'error': 'Too Many Requests',
                    'message': e.message,
                    'retry_after': e.retry_after
                })
                response.status_code = 429
                response.headers['Retry-After'] = str(e.retry_after)
                response.headers['X-RateLimit-Limit'] = str(effective_limit)
                response.headers['X-RateLimit-Remaining'] = '0'
                response.headers['X-RateLimit-Reset'] = str(int(time.time()) + e.retry_after)
                
                return response
        
        return decorated_function
    return decorator


def get_rate_limit_status(identifier: Optional[str] = None) -> dict:
    """
    Get current rate limit status for an identifier.
    Useful for monitoring and debugging.
    """
    if identifier is None:
        identifier = _limiter._get_identifier()
    
    # Return summary of current usage
    return {
        'identifier': identifier,
        'enabled': RATE_LIMIT_ENABLED,
        'storage': RATE_LIMIT_STORAGE
    }
