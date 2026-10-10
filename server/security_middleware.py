"""
Production-Grade Security Middleware
=====================================

Implements:
1. JWT-based authentication
2. Role-based access control (RBAC)
3. Token validation and refresh mechanisms
4. Secure secret management

WHY: Prevents unauthorized access to APIs and protects user data.
"""

import os
import jwt
import functools
from datetime import datetime, timedelta
from flask import request, jsonify, g
from typing import Optional, Callable, List
import logging

logger = logging.getLogger('plant-care-backend')

# Security Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '')
JWT_ALGORITHM = 'HS256'
JWT_ACCESS_TOKEN_EXPIRES = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES_MINUTES', 60))  # minutes
JWT_REFRESH_TOKEN_EXPIRES = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 7))  # days

# API Key for service-to-service authentication
API_KEY_HEADER = 'X-API-Key'
VALID_API_KEYS = set(filter(None, os.getenv('VALID_API_KEYS', '').split(',')))

# User roles
ROLE_ADMIN = 'admin'
ROLE_USER = 'user'
ROLE_GUEST = 'guest'


class SecurityError(Exception):
    """Base exception for security-related errors."""
    pass


class AuthenticationError(SecurityError):
    """Raised when authentication fails."""
    pass


class AuthorizationError(SecurityError):
    """Raised when user lacks required permissions."""
    pass


def generate_access_token(user_id: str, role: str = ROLE_USER, **kwargs) -> str:
    """
    Generate a JWT access token for a user.
    
    Args:
        user_id: Unique user identifier
        role: User's role (admin, user, guest)
        **kwargs: Additional claims to include in token
    
    Returns:
        JWT token string
    """
    if not JWT_SECRET_KEY:
        raise SecurityError("JWT_SECRET_KEY not configured")
    
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRES),
        'iat': datetime.utcnow(),
        'type': 'access',
        **kwargs
    }
    
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def generate_refresh_token(user_id: str) -> str:
    """Generate a long-lived refresh token."""
    if not JWT_SECRET_KEY:
        raise SecurityError("JWT_SECRET_KEY not configured")
    
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(days=JWT_REFRESH_TOKEN_EXPIRES),
        'iat': datetime.utcnow(),
        'type': 'refresh'
    }
    
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload
    
    Raises:
        AuthenticationError: If token is invalid, expired, or malformed
    """
    if not JWT_SECRET_KEY:
        raise SecurityError("JWT_SECRET_KEY not configured")
    
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(f"Invalid token: {str(e)}")


def extract_token_from_request() -> Optional[str]:
    """
    Extract JWT token from request headers.
    
    Supports:
    - Authorization: Bearer <token>
    - Authorization: <token>
    
    Returns:
        Token string or None if not found
    """
    auth_header = request.headers.get('Authorization', '')
    
    if auth_header.startswith('Bearer '):
        return auth_header[7:]  # Remove 'Bearer ' prefix
    elif auth_header:
        return auth_header
    
    return None


def extract_api_key_from_request() -> Optional[str]:
    """Extract API key from request headers."""
    return request.headers.get(API_KEY_HEADER)


def require_auth(roles: Optional[List[str]] = None):
    """
    Decorator to require JWT authentication on endpoints.
    
    Usage:
        @app.route('/api/protected')
        @require_auth()
        def protected_endpoint():
            user_id = g.user_id  # Access authenticated user ID
            return jsonify({'message': 'Success'})
    
        @app.route('/api/admin')
        @require_auth(roles=['admin'])
        def admin_endpoint():
            return jsonify({'message': 'Admin access granted'})
    
    Args:
        roles: Optional list of required roles (e.g., ['admin', 'user'])
    
    WHY: Ensures only authenticated users with proper roles can access endpoints.
         Prevents unauthorized access to sensitive APIs and data.
    """
    def decorator(f: Callable):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            # Extract token from request
            token = extract_token_from_request()
            
            if not token:
                logger.warning(f"Unauthorized access attempt to {request.path} - No token provided")
                return jsonify({
                    'error': 'Authentication required',
                    'message': 'Missing authorization token'
                }), 401
            
            try:
                # Decode and validate token
                payload = decode_token(token)
                
                # Validate token type
                if payload.get('type') != 'access':
                    raise AuthenticationError("Invalid token type")
                
                # Store user info in Flask's g object for use in endpoint
                g.user_id = payload.get('user_id')
                g.user_role = payload.get('role', ROLE_GUEST)
                g.token_payload = payload
                
                # Check role-based access control
                if roles and g.user_role not in roles:
                    logger.warning(
                        f"Forbidden access to {request.path} - "
                        f"User {g.user_id} has role {g.user_role}, requires {roles}"
                    )
                    return jsonify({
                        'error': 'Forbidden',
                        'message': 'Insufficient permissions'
                    }), 403
                
                # Log successful authentication
                logger.info(f"Authenticated request: user={g.user_id}, role={g.user_role}, path={request.path}")
                
                # Call the actual endpoint
                return f(*args, **kwargs)
                
            except AuthenticationError as e:
                logger.warning(f"Authentication failed for {request.path}: {str(e)}")
                return jsonify({
                    'error': 'Authentication failed',
                    'message': str(e)
                }), 401
            except Exception as e:
                logger.error(f"Unexpected authentication error: {str(e)}", exc_info=True)
                return jsonify({
                    'error': 'Internal server error',
                    'message': 'Authentication validation failed'
                }), 500
        
        return decorated_function
    return decorator


def require_api_key():
    """
    Decorator to require API key authentication (for service-to-service calls).
    
    Usage:
        @app.route('/api/internal')
        @require_api_key()
        def internal_endpoint():
            return jsonify({'message': 'Success'})
    
    WHY: Provides an alternative authentication method for automated systems,
         bots, or service-to-service communication where JWT isn't practical.
    """
    def decorator(f: Callable):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            api_key = extract_api_key_from_request()
            
            if not api_key:
                logger.warning(f"API key missing for {request.path}")
                return jsonify({
                    'error': 'Authentication required',
                    'message': f'Missing {API_KEY_HEADER} header'
                }), 401
            
            if not VALID_API_KEYS or api_key not in VALID_API_KEYS:
                logger.warning(f"Invalid API key attempt for {request.path}")
                return jsonify({
                    'error': 'Authentication failed',
                    'message': 'Invalid API key'
                }), 401
            
            logger.info(f"API key authenticated for {request.path}")
            g.auth_method = 'api_key'
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def optional_auth():
    """
    Decorator that attempts authentication but doesn't require it.
    Useful for endpoints that have different behavior for authenticated users.
    
    Usage:
        @app.route('/api/public')
        @optional_auth()
        def public_endpoint():
            if hasattr(g, 'user_id'):
                return jsonify({'message': f'Hello {g.user_id}'})
            return jsonify({'message': 'Hello guest'})
    """
    def decorator(f: Callable):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            token = extract_token_from_request()
            
            if token:
                try:
                    payload = decode_token(token)
                    g.user_id = payload.get('user_id')
                    g.user_role = payload.get('role', ROLE_GUEST)
                    g.token_payload = payload
                except Exception:
                    # Silently fail for optional auth
                    pass
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator
