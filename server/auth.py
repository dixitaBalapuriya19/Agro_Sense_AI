"""
Authentication module for AgroSense.
Implements JWT creation, decoding, and route protection decorators.
"""

import os
import jwt
import datetime
from functools import wraps
from flask import request, jsonify
from database import get_user_by_id

JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'agrosense_jwt_dev_secret_key_834712093847123')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_DAYS = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES_DAYS', 7))


def generate_auth_token(user_id: int, email: str, username: str) -> str:
    """Generate a signed JWT token valid for 7 days."""
    payload = {
        'sub': user_id,
        'email': email,
        'username': username,
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRES_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_auth_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def token_required(f):
    """Decorator to require and validate Bearer JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Authorization header is missing'}), 401
            
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'error': 'Invalid token format. Format must be: Bearer <token>'}), 401
            
        token = parts[1]
        try:
            payload = decode_auth_token(token)
            user_id = payload.get('sub')
            user = get_user_by_id(user_id)
            if not user:
                return jsonify({'error': 'User associated with token no longer exists'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Session expired. Please log in again.'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
        except Exception as e:
            return jsonify({'error': 'Authentication failed'}), 401
            
        return f(current_user=user, *args, **kwargs)
        
    return decorated
