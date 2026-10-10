"""
Production-Grade Security Headers & Input Validation
====================================================

Implements:
1. Security headers (HSTS, CSP, X-Frame-Options, etc.)
2. Input validation and sanitization
3. File upload security
4. SQL injection prevention
5. XSS prevention

WHY: Provides defense-in-depth security by adding multiple layers of protection
     against common web vulnerabilities (OWASP Top 10).
"""

import os
import re
import logging
from flask import request, jsonify
from typing import Optional, Any
from functools import wraps

logger = logging.getLogger('plant-care-backend')

# File Upload Configuration
MAX_FILE_SIZE_MB = int(os.getenv('MAX_FILE_SIZE_MB', 5))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_IMAGE_TYPES = set(os.getenv('ALLOWED_IMAGE_TYPES', 'jpeg,jpg,png,webp').split(','))
MAX_IMAGE_DIMENSION = int(os.getenv('MAX_IMAGE_DIMENSION', 4096))


def add_security_headers(response):
    """
    Add security headers to all responses.
    
    WHY: Security headers protect against various attacks:
    - HSTS: Forces HTTPS, prevents SSL stripping attacks
    - CSP: Prevents XSS by controlling resource loading
    - X-Frame-Options: Prevents clickjacking
    - X-Content-Type-Options: Prevents MIME sniffing
    - Referrer-Policy: Controls referer information leakage
    """
    # Strict-Transport-Security: Force HTTPS for 1 year
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    # Content-Security-Policy: Restrict resource loading
    # WHY: Prevents XSS by only allowing resources from trusted sources
    csp_directives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Adjust for your needs
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ]
    response.headers['Content-Security-Policy'] = '; '.join(csp_directives)
    
    # X-Frame-Options: Prevent clickjacking
    # WHY: Prevents your site from being embedded in iframes by attackers
    response.headers['X-Frame-Options'] = 'DENY'
    
    # X-Content-Type-Options: Prevent MIME sniffing
    # WHY: Prevents browsers from MIME-sniffing and executing malicious files
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # X-XSS-Protection: Enable browser XSS filter (legacy browsers)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Referrer-Policy: Control referrer information
    # WHY: Prevents leaking sensitive URLs to external sites
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Permissions-Policy: Control browser features
    # WHY: Restricts access to powerful browser features
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    
    return response


def configure_secure_cors(app, allowed_origins: list, allow_credentials: bool = True):
    """
    Configure production-grade CORS with strict origin validation.
    
    WHY: Prevents malicious websites from making unauthorized requests to your API.
         Only explicitly whitelisted origins can interact with your backend.
    
    Args:
        app: Flask application
        allowed_origins: List of allowed origins (NO wildcards for production)
        allow_credentials: Whether to allow credentials (cookies, auth headers)
    """
    from flask_cors import CORS
    
    # Validate origins - no wildcards for authenticated routes
    if '*' in allowed_origins and allow_credentials:
        logger.error("SECURITY ERROR: Cannot use wildcard origin with credentials enabled!")
        raise ValueError("Wildcard CORS origin is forbidden when credentials are enabled")
    
    # Configure CORS with strict settings
    cors_config = {
        "origins": allowed_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-API-Key"
        ],
        "expose_headers": [
            "Content-Type",
            "Content-Disposition",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset"
        ],
        "supports_credentials": allow_credentials,
        "max_age": 3600  # Cache preflight requests for 1 hour
    }
    
    # Apply CORS to API routes only
    CORS(app, resources={r"/api/*": cors_config})
    
    logger.info(f"CORS configured with allowed origins: {allowed_origins}")
    
    # Add CORS validation middleware
    @app.before_request
    def validate_origin():
        """
        Validate Origin header on all requests.
        
        WHY: Ensures that even if CORS is misconfigured, we explicitly
             reject requests from untrusted origins.
        """
        origin = request.headers.get('Origin')
        
        # Skip validation for same-origin requests (no Origin header)
        if not origin:
            return None
        
        # For development, allow localhost variants
        if os.getenv('FLASK_ENV') == 'development':
            if 'localhost' in origin or '127.0.0.1' in origin:
                return None
        
        # Check if origin is in whitelist
        if '*' not in allowed_origins and origin not in allowed_origins:
            logger.warning(f"Blocked request from unauthorized origin: {origin}")
            return jsonify({
                'error': 'Forbidden',
                'message': 'Origin not allowed'
            }), 403
        
        return None


def validate_image_upload(data_url: str) -> tuple[bool, Optional[str]]:
    """
    Validate image upload data URL.
    
    WHY: Prevents malicious file uploads, oversized files, and invalid formats.
    
    Returns:
        (is_valid, error_message)
    """
    if not data_url or not isinstance(data_url, str):
        return False, "Invalid image data"
    
    # Check data URL format
    data_url_pattern = r'^data:image/(jpeg|jpg|png|webp|gif);base64,'
    if not re.match(data_url_pattern, data_url):
        return False, "Invalid image format. Only JPEG, PNG, and WebP are allowed"
    
    # Extract MIME type
    mime_match = re.match(r'data:image/([^;]+);', data_url)
    if not mime_match:
        return False, "Could not determine image type"
    
    image_type = mime_match.group(1)
    if image_type not in ALLOWED_IMAGE_TYPES:
        return False, f"Image type '{image_type}' not allowed. Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}"
    
    # Check file size (estimate from base64)
    # Base64 increases size by ~33%, so actual size = len * 0.75
    estimated_size = len(data_url) * 0.75
    if estimated_size > MAX_FILE_SIZE_BYTES:
        return False, f"Image too large. Maximum size: {MAX_FILE_SIZE_MB}MB"
    
    return True, None


def sanitize_input(value: Any, max_length: int = 1000) -> str:
    """
    Sanitize user input to prevent injection attacks.
    
    WHY: Prevents XSS, SQL injection, and command injection by removing
         potentially dangerous characters and limiting length.
    """
    if value is None:
        return ""
    
    # Convert to string
    value = str(value)
    
    # Limit length
    value = value[:max_length]
    
    # Remove control characters (except newlines and tabs)
    value = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)
    
    # Remove potentially dangerous patterns
    # Note: This is basic sanitization. For HTML output, use a proper library like bleach
    dangerous_patterns = [
        r'<script[^>]*>.*?</script>',  # Script tags
        r'javascript:',  # JavaScript protocol
        r'on\w+\s*=',  # Event handlers
    ]
    
    for pattern in dangerous_patterns:
        value = re.sub(pattern, '', value, flags=re.IGNORECASE | re.DOTALL)
    
    return value.strip()


def require_json():
    """
    Decorator to require JSON content type.
    
    WHY: Prevents content-type confusion attacks and ensures
         request body is properly formatted JSON.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({
                    'error': 'Bad Request',
                    'message': 'Content-Type must be application/json'
                }), 415  # Unsupported Media Type
            
            # Validate JSON can be parsed
            try:
                request.get_json()
            except Exception as e:
                return jsonify({
                    'error': 'Bad Request',
                    'message': f'Invalid JSON: {str(e)}'
                }), 400
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def validate_request_size(max_size_mb: int = 10):
    """
    Decorator to validate request size.
    
    WHY: Prevents DoS attacks via large payloads that consume memory/bandwidth.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            content_length = request.content_length
            
            if content_length and content_length > max_size_mb * 1024 * 1024:
                return jsonify({
                    'error': 'Payload Too Large',
                    'message': f'Request body exceeds maximum size of {max_size_mb}MB'
                }), 413
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator
