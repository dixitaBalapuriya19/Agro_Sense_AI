import base64
"""
Plant Care Backend (Flask)

Provides API endpoints for plant disease analysis with CORS,
structured logging, health checks, rate limiting, and environment-based config.
"""

import io
import os
import re
import time
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from typing import List, Tuple, Optional, Any
from PIL import Image

import requests
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from deep_translator import GoogleTranslator

# Import caching and timeout optimization
from analysis_cache import analysis_cache, get_optimized_timeout
from rate_limiting import rate_limit, RateLimitExceeded
from security_headers import add_security_headers

# Database and Authentication
import database
import auth
from auth import token_required

try:
    database.init_db()
except Exception as _dbe:
    pass

# Optional ML libraries (only needed for LLaVA model)
try:
    import torch
    import torchvision.transforms as transforms
    from transformers import AutoProcessor, LlavaForConditionalGeneration
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    torch = None
    transforms = None
    AutoProcessor = None
    LlavaForConditionalGeneration = None


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

PORT = int(os.getenv('PORT', 8000))
HOST = os.getenv('HOST', '0.0.0.0')
DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

# Request limits (16 MB default maximum request payload)
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))

# CORS origins (comma-separated) or *
raw_origins = os.getenv('CORS_ORIGINS', '*')
CORS_ORIGINS: List[str] = (
    [o.strip() for o in raw_origins.split(',') if o.strip()] if raw_origins != '*' else ['*']
)
ALLOW_VERCEL_PREVIEW_ORIGINS = os.getenv('ALLOW_VERCEL_PREVIEW_ORIGINS', 'true').lower() == 'true'

HUGGINGFACE_API_KEY = os.getenv('HUGGINGFACE_API_KEY', '').strip()
HUGGINGFACE_MODEL = os.getenv('HUGGINGFACE_MODEL', 'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification').strip()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '').strip()
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash').strip()
LLAVA_MODEL_ID = "YuchengShi/LLaVA-v1.5-7B-Plant-Leaf-Diseases-Detection"
LOCAL_LLM_URL = os.getenv('LOCAL_LLM_URL', 'http://localhost:1234/v1').strip()
LOCAL_LLM_MODEL = os.getenv('LOCAL_LLM_MODEL', 'llava-llama-3-8b-v1_1-gguf').strip()
PROVIDER_ORDER = [p.strip() for p in os.getenv('PROVIDER_ORDER', 'gemini,hf,mock').split(',') if p.strip()]
ALLOW_MOCK_FALLBACK = os.getenv('ALLOW_MOCK_FALLBACK', 'false').lower() == 'true'
LOCAL_LLM_TIMEOUT_SECONDS = int(os.getenv('LOCAL_LLM_TIMEOUT_SECONDS', '8'))
HUGGINGFACE_TIMEOUT_SECONDS = int(os.getenv('HUGGINGFACE_TIMEOUT_SECONDS', '15'))
GEMINI_TIMEOUT_SECONDS = int(os.getenv('GEMINI_TIMEOUT_SECONDS', '45'))

# Environmental Data APIs
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', '').strip()
SOIL_API_KEY = os.getenv('SOIL_API_KEY', '').strip()
SOIL_API_URL = os.getenv('SOIL_API_URL', 'https://api.soilhive.ag/v1').strip()
DEFAULT_LOCATION = os.getenv('DEFAULT_LOCATION', 'Rajkot,Gujarat,IN').strip()
DEFAULT_LATITUDE = float(os.getenv('DEFAULT_LATITUDE', '22.3039'))
DEFAULT_LONGITUDE = float(os.getenv('DEFAULT_LONGITUDE', '70.8022'))


# ----------------------------------------------------------------------------
# App & Logging Setup
# ----------------------------------------------------------------------------
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

if CORS_ORIGINS == ['*']:
    cors_origins_config = "*"
else:
    cors_origins_config = [
        re.compile(r"^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$")
    ]
    for origin in CORS_ORIGINS:
        origin_clean = origin.rstrip('/')
        if origin_clean and not origin_clean.startswith('http://localhost') and not origin_clean.startswith('http://127.0.0.1'):
            cors_origins_config.append(origin_clean)
    if ALLOW_VERCEL_PREVIEW_ORIGINS:
        cors_origins_config.append(re.compile(r"^https:\/\/.*\.vercel\.app$"))

CORS(app, resources={
    r"/api/*": {
        "origins": cors_origins_config,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"],
        "expose_headers": ["Content-Type", "Content-Disposition", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
        "supports_credentials": False,
        "max_age": 3600
    }
})


def _is_allowed_origin(origin: str) -> bool:
    if not origin:
        return False
    normalized_origin = origin.rstrip('/').lower()

    if CORS_ORIGINS == ['*']:
        return True

    # Permit all local development host/port permutations
    if re.match(r"^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$", normalized_origin):
        return True

    normalized_allowed = [allowed.rstrip('/').lower() for allowed in CORS_ORIGINS]
    if normalized_origin in normalized_allowed:
        return True

    for allowed in normalized_allowed:
        if '*' in allowed:
            pattern = '^' + re.escape(allowed).replace('\\*', '.*') + '$'
            if re.match(pattern, normalized_origin):
                return True

    if ALLOW_VERCEL_PREVIEW_ORIGINS and re.match(r"^https:\/\/.*\.vercel\.app$", normalized_origin):
        return True

    return False


@app.after_request
def apply_security_and_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin and _is_allowed_origin(origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-API-Key'
        response.headers['Access-Control-Max-Age'] = '3600'
    
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response


@app.route('/api/<path:path>', methods=['OPTIONS'])
@app.route('/api', methods=['OPTIONS'])
def handle_options_preflight(path=''):
    response = app.make_default_options_response()
    origin = request.headers.get('Origin')
    if origin and _is_allowed_origin(origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-API-Key'
    return response


def _setup_logging() -> logging.Logger:
    logger = logging.getLogger('plant-care-backend')
    logger.setLevel(logging.DEBUG)
    logger.propagate = False

    if not logger.handlers:
        log_dir = os.path.join(BASE_DIR, 'logs')
        os.makedirs(log_dir, exist_ok=True)

        file_handler = RotatingFileHandler(
            os.path.join(log_dir, 'app.log'), maxBytes=1_000_000, backupCount=3, encoding='utf-8'
        )
        console_handler = logging.StreamHandler()

        fmt = logging.Formatter(
            '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(fmt)
        console_handler.setFormatter(fmt)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

    return logger


logger = _setup_logging()

# Language translation support using deep-translator


# ----------------------------------------------------------------------------
# Domain Data & Helpers
# ----------------------------------------------------------------------------
# NOTE: DISEASE_DATABASE is ONLY used for /api/diseases endpoint (reference list)
# It is NOT used for actual image analysis - all analysis is done by AI models
DISEASE_DATABASE = {
    'powdery_mildew': {
        'name': 'Powdery Mildew',
        'severity': 'high',
        'description': 'Fungal infection causing white powder-like coating on leaves and stems. This disease thrives in warm, humid conditions and can spread rapidly to other plants.',
        'remedies': [
            {'step': 1, 'action': 'Remove heavily infected leaves immediately to contain spore spread', 'timeframe': 'Immediately'},
            {'step': 2, 'action': 'Apply sulfur dust, potassium bicarbonate, or neem oil spray thoroughly to affected surfaces', 'timeframe': 'Every 7 days for 2-3 weeks'},
            {'step': 3, 'action': 'Improve air circulation by increasing fan ventilation or spacing plants further apart', 'timeframe': 'Ongoing'},
            {'step': 4, 'action': 'Avoid overhead misting and water strictly at soil level in early morning', 'timeframe': 'Daily monitoring'},
        ],
        'prescribed_care': {
            'overview': 'Powdery mildew is a common fungal condition managed through isolation, gentle fungicidal sprays, and environmental humidity control.',
            'immediate_actions': [
                'Isolate the plant from other foliage to prevent spore drift',
                'Spray affected areas with an organic sulfur-based or neem oil preparation',
                'Remove heavily dusted or necrotic leaves with clean shears',
                'Wash hands and tools with 70% alcohol after handling'
            ],
            'treatment_schedule': [
                {'week': 1, 'action': 'Apply organic spray every 4-5 days', 'notes': 'Ensure undersides of leaves receive spray coverage'},
                {'week': 2, 'action': 'Continue weekly application, monitor emerging shoots', 'notes': 'Check new growth for powdery film'},
                {'week': 3, 'action': 'Reduce frequency if symptoms subside', 'notes': 'Only re-treat if fresh white patches appear'},
                {'week': 4, 'action': 'Maintain preventative ventilation and soil-level watering', 'notes': 'Keep canopy ventilated'}
            ],
            'environmental_improvements': [
                'Increase ambient airflow around the plant canopy',
                'Keep ambient relative humidity around 45-55%',
                'Space plants at least 12-18 inches apart',
                'Water plants early in the day at soil level only',
                'Ensure potting soil drains freely'
            ],
            'prevention': [
                'Inspect new specimens before introducing them to the garden',
                'Avoid crowding containers together',
                'Water roots without splashing soil onto foliage',
                'Prune congested interior branches to promote airflow'
            ]
        }
    },
    'leaf_spot': {
        'name': 'Leaf Spot Disease',
        'severity': 'medium',
        'description': 'Bacterial or fungal infection causing discrete brown, black, or yellow-haloed spots on foliage. Often exacerbated by prolonged surface leaf moisture.',
        'remedies': [
            {'step': 1, 'action': 'Isolate the plant and avoid touching wet leaves', 'timeframe': 'Immediately'},
            {'step': 2, 'action': 'Prune spotted leaves showing extensive lesions and discard safely', 'timeframe': 'Within 24 hours'},
            {'step': 3, 'action': 'Apply copper soap or biofungicide spray if spots continue spreading to new growth', 'timeframe': 'Every 10-14 days as needed'},
            {'step': 4, 'action': 'Water strictly at the soil line to keep foliage completely dry', 'timeframe': 'Ongoing'},
        ],
        'prescribed_care': {
            'overview': 'Foliar leaf spots are manageable through sanitation, selective pruning, and strict avoidance of wet leaves.',
            'immediate_actions': [
                'Remove leaves showing active spot clusters',
                'Sterilize shears between cuts with rubbing alcohol',
                'Move plant to a well-ventilated, bright location',
                'Cease any overhead sprinkling or leaf misting'
            ],
            'treatment_schedule': [
                {'week': 1, 'action': 'Inspect daily, trim infected leaves, apply protective spray if severe', 'notes': 'Cut at leaf petiole base'},
                {'week': 2, 'action': 'Continue gentle monitoring and evaluate new growth', 'notes': 'New leaves should remain blemish-free'},
                {'week': 3, 'action': 'Assess foliage health and discontinue spray if lesions stabilize', 'notes': 'Check lower canopy'},
                {'week': 4, 'action': 'Resume normal maintenance with strict base-only watering', 'notes': 'Maintain dry leaves'}
            ],
            'environmental_improvements': [
                'Ensure excellent air circulation around all leaf tiers',
                'Keep leaves dry — water solely into the pot soil',
                'Maintain moderate humidity (40-50%)',
                'Space pots so foliage does not touch adjacent plants',
                'Remove fallen leaf debris promptly'
            ],
            'prevention': [
                'Always direct irrigation water to the soil base',
                'Irrigate early in the morning so accidental splashes dry quickly',
                'Sanitize pruning tools regularly',
                'Avoid handling foliage when wet'
            ]
        }
    },
    'root_rot': {
        'name': 'Root Rot',
        'severity': 'critical',
        'description': 'Severe decay of root tissue caused by waterlogged, anaerobic soil conditions and fungal/oomycete pathogens. Roots turn brown/black and mushy.',
        'remedies': [
            {'step': 1, 'action': 'Halt watering immediately and ease plant from pot to inspect root health', 'timeframe': 'Immediate'},
            {'step': 2, 'action': 'Prune away black, mushy, or foul-smelling roots using sterilized shears', 'timeframe': 'Same day'},
            {'step': 3, 'action': 'Repot into fresh, sterile, fast-draining potting mix with perlite or pumice', 'timeframe': 'Same day'},
            {'step': 4, 'action': 'Withhold irrigation for several days to allow root callusing before light hydration', 'timeframe': '3-5 days'},
        ],
        'prescribed_care': {
            'overview': 'Root rot is a critical condition requiring rapid intervention to rescue remaining healthy root structure and restore soil aeration.',
            'immediate_actions': [
                'Unpot the plant gently and rinse excess soggy soil from roots',
                'Examine roots: firm tan/white roots are healthy, dark mushy roots are damaged',
                'Excise diseased roots back to clean tissue with sterilized tools',
                'Discard the old contaminated soil and wash pot thoroughly'
            ],
            'treatment_schedule': [
                {'day': '1-2', 'action': 'Repot in airy soil mix, position in bright indirect light', 'notes': 'Keep root ball unwatered'},
                {'day': '3-7', 'action': 'Keep moderately dry, monitor foliage for stabilization', 'notes': 'Allow root wounds to seal'},
                {'day': '8-14', 'action': 'Provide conservative, light watering only when topsoil is completely dry', 'notes': 'Do not saturate'},
                {'week': '3-4', 'action': 'Gradually resume standard cycle as new root growth establishes', 'notes': 'Verify pot drains freely'}
            ],
            'environmental_improvements': [
                'Use well-aerated potting soil (amend with 30% perlite or pumice)',
                'Ensure containers have unobstructed drainage holes',
                'Elevate pot slightly or empty drip saucers within 15 minutes of watering',
                'Maintain warm ambient temperature (20-24°C) to stimulate root regeneration'
            ],
            'prevention': [
                'Water only when top 1-2 inches of soil feels dry to the touch',
                'Never permit pots to stand in stagnant drainage water',
                'Use lightweight, coarse potting media rather than dense garden clay',
                'Avoid oversized pots that retain excessive unrooted soil volume'
            ]
        }
    },
    'pest_infestation': {
        'name': 'Pest Infestation',
        'severity': 'high',
        'description': 'Infestation by sap-feeding insects such as spider mites, aphids, thrips, mealybugs, or scale. Causes stippling, honeydew, yellowing, or leaf distortion.',
        'remedies': [
            {'step': 1, 'action': 'Inspect leaf undersides and stem junctions with a magnifying lens', 'timeframe': 'Immediately'},
            {'step': 2, 'action': 'Isolate plant from other specimens to contain pest migration', 'timeframe': 'Within 1 hour'},
            {'step': 3, 'action': 'Wipe or rinse leaves, then apply insecticidal soap or horticultural neem oil spray', 'timeframe': 'Every 5-7 days for 3 cycles'},
            {'step': 4, 'action': 'Inspect weekly to target newly hatched generations', 'timeframe': 'Weekly for 3 weeks'},
        ],
        'prescribed_care': {
            'overview': 'Pest management relies on physical isolation, mechanical washing, and repeated applications of contact insecticidal soap or neem oil.',
            'immediate_actions': [
                'Move plant to quarantine space away from other collection plants',
                'Identify whether pests are mites, aphids, mealybugs, or scale',
                'Rinse foliage with gentle water spray to dislodge active pests',
                'Wipe stems and leaf axils with a damp cloth or cotton swab'
            ],
            'treatment_schedule': [
                {'week': 1, 'action': 'Apply insecticidal soap or neem spray to all leaf surfaces', 'notes': 'Spray both upper and lower leaf surfaces'},
                {'week': 2, 'action': 'Repeat spray application to catch second-generation nymphs', 'notes': 'Avoid spraying under hot direct sunlight'},
                {'week': 3, 'action': 'Inspect under magnification; apply spot treatment if pests persist', 'notes': 'Check leaf nodes and buds'},
                {'week': 4, 'action': 'Return to collection only when zero pests observed for 10 days', 'notes': 'Re-inspect before reintegration'}
            ],
            'environmental_improvements': [
                'Increase relative humidity if managing spider mites (they thrive in hot, dry air)',
                'Ensure gentle air circulation to reduce pest settling',
                'Provide optimal bright indirect light to bolster plant immunity',
                'Avoid over-fertilizing with nitrogen, which promotes vulnerable tender growth'
            ],
            'prevention': [
                'Quarantine all newly acquired plants for 14 days before adding to garden',
                'Perform weekly visual inspections under leaf blades',
                'Dust and clean foliage periodically with a damp cloth',
                'Act promptly at the first sign of webbing or stippling'
            ]
        }
    },
    'yellow_leaves': {
        'name': 'Yellowing Leaves (Chlorosis)',
        'severity': 'medium',
        'description': 'Foliar yellowing commonly resulting from overwatering, poor drainage, insufficient light, or nutrient imbalance. Symptoms may be uniform or interveinal.',
        'remedies': [
            {'step': 1, 'action': 'Test soil moisture at root depth and allow soil to dry if soggy', 'timeframe': 'Immediately'},
            {'step': 2, 'action': 'Adjust watering cadence to match species needs and current evaporation rate', 'timeframe': 'Ongoing'},
            {'step': 3, 'action': 'Apply a balanced, diluted micronutrient-rich liquid fertilizer during active growth', 'timeframe': 'Next scheduled watering'},
            {'step': 4, 'action': 'Verify pot drainage holes are clear of obstruction', 'timeframe': 'Within 2 days'},
        ],
        'prescribed_care': {
            'overview': 'Chlorosis reflects cultural stress rather than an incurable disease. Diagnosing watering frequency and lighting usually corrects the issue.',
            'immediate_actions': [
                'Check root moisture using a wooden skewer or finger test',
                'If soil is saturated, withhold water and ensure pot drains freely',
                'Move specimen closer to bright, gentle indirect sunlight',
                'Remove fully collapsed or dead leaves to redirect plant energy'
            ],
            'treatment_schedule': [
                {'week': 1, 'action': 'Regulate watering; let top 1-2 inches dry out between waterings', 'notes': 'Monitor leaf firmness'},
                {'week': 2, 'action': 'Supply half-strength balanced fertilizer if underfed', 'notes': 'Skip fertilizer if soil was soggy'},
                {'week': 3, 'action': 'Observe new terminal leaves for healthy green coloration', 'notes': 'New growth indicates recovery'},
                {'week': 4, 'action': 'Maintain consistent light and moisture routines', 'notes': 'Prevent rapid environmental shifts'}
            ],
            'environmental_improvements': [
                'Provide 6-8 hours of bright indirect sunlight daily',
                'Protect plant from cold drafts, air conditioner vents, and heaters',
                'Maintain steady room temperature between 18-24°C',
                'Ensure potting soil has adequate aeration'
            ],
            'prevention': [
                'Water on soil feel rather than a rigid calendar schedule',
                'Use pots with drainage holes at all times',
                'Feed lightly during spring and summer active growth seasons',
                'Repot every 18-24 months to replenish exhausted soil nutrients'
            ]
        }
    }
}

MOCK_PLANT_NAMES = [
    "Monstera Deliciosa", "Ficus Lyrata (Fiddle Leaf Fig)", "Sansevieria (Snake Plant)", 
    "Spathiphyllum (Peace Lily)", "Ocimum Basilicum (Basil)", "Rose", "Tomato Plant"
]

MOCK_SEASONAL_TIPS = [
    "Spring: Increase watering as new growth appears. Fertilize lightly.",
    "Summer: Protect from direct scorching sun. Water frequently but ensure drainage.",
    "Autumn: Reduce watering as growth slows. Prune dead leaves.",
    "Winter: Keep away from cold drafts. Water sparingly."
]

# Validated pathology severity dictionary
DISEASE_SEVERITY_MAP = {
    # Critical - rapidly fatal root or vascular pathologies
    'root_rot': 'critical',
    'damping_off': 'critical',
    'bacterial_wilt': 'critical',
    'late_blight': 'critical',
    'fusarium_wilt': 'critical',
    'verticillium_wilt': 'critical',

    # High - aggressive foliar, systemic, or destructive infections
    'powdery_mildew': 'high',
    'downy_mildew': 'high',
    'early_blight': 'high',
    'black_rot': 'high',
    'anthracnose': 'high',
    'fire_blight': 'high',
    'citrus_canker': 'high',
    'pest_infestation': 'high',
    'rust': 'high',
    'mosaic_virus': 'high',

    # Medium - moderate or localized conditions, deficiencies, manageable foliar spots
    'leaf_spot': 'medium',
    'cercospora_leaf_spot': 'medium',
    'septoria_leaf_spot': 'medium',
    'yellow_leaves': 'medium',
    'chlorosis': 'medium',
    'scab': 'medium',
    'leaf_scorch': 'medium',
    'nutrient_deficiency': 'medium',

    # Low - healthy or minor non-pathological blemishes
    'healthy': 'low',
    'sunburn': 'low',
    'edema': 'low',
}


def determine_disease_severity(disease_name: str, raw_severity: Optional[str] = None) -> str:
    """
    Determine disease severity using validated domain pathology rules.
    Decoupled from model prediction confidence.
    """
    if not disease_name:
        return 'unknown'
        
    d_clean = disease_name.lower().strip()
    if 'healthy' in d_clean:
        return 'low'

    # Check known pathology keys
    for key, sev in DISEASE_SEVERITY_MAP.items():
        if key in d_clean.replace(' ', '_') or key.replace('_', ' ') in d_clean:
            return sev
            
    # If the provider returned a validated severity category, preserve it
    if raw_severity and raw_severity.lower() in ('critical', 'high', 'medium', 'low'):
        return raw_severity.lower()
        
    return 'uncertain'


def validate_confidence(raw_confidence: Any) -> Tuple[Optional[int], bool]:
    """
    Validate and normalize model confidence (0-100 integer).
    Returns (normalized_confidence, is_valid).
    """
    try:
        if raw_confidence is None:
            return None, False
        if isinstance(raw_confidence, float) and 0.0 <= raw_confidence <= 1.0:
            val = int(round(raw_confidence * 100))
        else:
            val = int(round(float(raw_confidence)))
        if 0 <= val <= 100:
            return val, True
        return None, False
    except (ValueError, TypeError):
        return None, False


def validate_and_decode_image(data_url: str) -> Tuple[Optional[str], Optional[bytes], Optional[str], int]:
    """
    Validate data URL and raw image bytes.
    Enforces format, dimensions, pixel limit to mitigate decompression bombs.
    Returns (mime_type, image_bytes, error_message, status_code).
    """
    if not data_url or not isinstance(data_url, str):
        return None, None, "Missing or invalid image data.", 400
        
    # Check max string length (~25MB base64)
    if len(data_url) > 25 * 1024 * 1024:
        return None, None, "Payload exceeds maximum allowed size.", 413
        
    match = re.match(r'^data:(?P<mime>image/[a-zA-Z0-9\.\+\-_]+);base64,(?P<data>[A-Za-z0-9+/=]+)$', data_url.strip())
    if not match:
        return None, None, "Invalid data URL format. Expected 'data:image/<type>;base64,<payload>'", 400
        
    mime = match.group('mime').lower()
    allowed_mimes = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp'}
    if mime not in allowed_mimes:
        return None, None, f"Unsupported image format '{mime}'. Supported formats: JPEG, PNG, WebP.", 415
        
    try:
        img_bytes = base64.b64decode(match.group('data'), validate=True)
    except Exception:
        return None, None, "Malformed base64 image data.", 400
        
    if len(img_bytes) == 0:
        return None, None, "Image data is empty.", 400
        
    # Pillow bytes inspection
    try:
        img_io = io.BytesIO(img_bytes)
        with Image.open(img_io) as img:
            img.verify()
            
        img_io.seek(0)
        with Image.open(img_io) as img:
            format_name = (img.format or '').lower()
            if format_name not in ('jpeg', 'png', 'webp', 'mpo'):
                return None, None, f"Decoded file is not a supported image format ({format_name}).", 415
            width, height = img.size
            if width <= 0 or height <= 0:
                return None, None, "Invalid image dimensions.", 400
            if width > 4096 or height > 4096:
                return None, None, f"Image dimensions ({width}x{height}) exceed maximum allowed (4096x4096px).", 400
            if (width * height) > 20_000_000:
                return None, None, "Image pixel count exceeds safe processing threshold.", 400
    except Exception as e:
        logger.warning(f"Image validation failed: {e}")
        return None, None, "Unable to decode image. File may be corrupted or unsupported.", 400
        
    return mime, img_bytes, None, 200


def generate_mock_result():
    """EMERGENCY FALLBACK ONLY - Generate mock result when ALL AI providers fail.
    This is NOT used for normal analysis - only when Gemini/HF/LLaVA are unavailable.
    Returns minimal data to indicate analysis was unsuccessful."""
    return {
        'plant_name': 'Unknown Plant',
        'disease': 'Unable to Determine',
        'confidence': 0,
        'severity': 'unknown',
        'description': 'Automated visual analysis could not be completed for this image. Please ensure the photograph shows a well-lit, in-focus view of the affected plant foliage.',
        'remedies': [
            {'step': 1, 'action': 'Retake photo under clear natural lighting focusing closely on the affected leaf surface', 'timeframe': 'Before retry'},
            {'step': 2, 'action': 'Inspect leaf undersides and stem bases manually for visible pests or spots', 'timeframe': 'Initial inspection'}
        ],
        'seasonal_tips': 'Please capture a clear, well-focused image for reliable botanical diagnosis.',
        'prescribed_care': {
            'overview': 'Automated visual inference could not be completed with the uploaded image.',
            'immediate_actions': ['Upload a clearer, focused photo', 'Ensure leaves are well-lit and fill the frame'],
            'treatment_schedule': [],
            'environmental_improvements': [],
            'prevention': []
        },
        'is_mock': True
    }


def _parse_data_url_size(data_url: str) -> int:
    try:
        _, b64 = data_url.split(',', 1)
        return len(b64)
    except Exception:
        return 0


def _parse_data_url(data_url: str) -> Tuple[Optional[str], Optional[bytes]]:
    """Parse data URL securely, validating image content."""
    mime, img_bytes, err, _ = validate_and_decode_image(data_url)
    if err or not img_bytes:
        return None, None
    return mime, img_bytes



# ----------------------------------------------------------------------------
# Provider Integrations (must be before routes that use them)
# ----------------------------------------------------------------------------
# Lazy loading globals to avoid startup lag
_hf_processor = None
_hf_model = None
PROVIDER_LAST_ERRORS = {}


def _set_provider_error(provider: str, message: str) -> None:
    PROVIDER_LAST_ERRORS[provider] = message


def _clear_provider_error(provider: str) -> None:
    PROVIDER_LAST_ERRORS.pop(provider, None)


def _get_provider_error(provider: str) -> Optional[str]:
    return PROVIDER_LAST_ERRORS.get(provider)

# ----------------------------------------------------------------------------
# Local LLM Studio Integration
# ----------------------------------------------------------------------------
def analyze_with_local_llm(image_bytes: bytes) -> Optional[dict]:
    """
    Analyze plant image using local LLM Studio.
    LLM Studio provides OpenAI-compatible API on localhost:1234
    """
    try:
        _clear_provider_error('local')
        import json
        
        logger.info(f"Analyzing with Local LLM Studio: {LOCAL_LLM_URL}")
        
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
        payload = {
            "model": LOCAL_LLM_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Analyze this plant leaf image and provide:
1. Plant Name (species or common name)
2. Disease Status (specific disease name or "Healthy")
3. Confidence level (0-100 integer)
4. Description of visible symptoms
5. Practical, conservative treatment recommendations

Respond strictly in JSON format:
{
  "plant_name": "name",
  "disease": "disease or Healthy",
  "confidence": 85,
  "severity": "critical|high|medium|low|uncertain",
  "description": "detailed description",
  "remedies": [
    {"step": 1, "action": "Action description", "timeframe": "Timing"}
  ]
}"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_b64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 500,
            "temperature": 0.1
        }
        
        response = requests.post(
            f"{LOCAL_LLM_URL}/chat/completions",
            json=payload,
            timeout=LOCAL_LLM_TIMEOUT_SECONDS
        )
        
        if response.status_code != 200:
            logger.error(f"Local LLM error: {response.status_code} - {response.text}")
            _set_provider_error('local', f'http_{response.status_code}')
            return None
            
        result = response.json()
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
        
        logger.debug(f"Local LLM raw response: {content}")
        
        try:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end != -1:
                json_str = content[start:end]
                data = json.loads(json_str)
                
                remedies_list = data.get('remedies', [])
                remedies_formatted = []
                for i, remedy in enumerate(remedies_list):
                    if isinstance(remedy, str):
                        remedies_formatted.append({
                            'step': i + 1,
                            'action': remedy,
                            'timeframe': 'As needed'
                        })
                    elif isinstance(remedy, dict):
                        remedies_formatted.append({
                            'step': remedy.get('step', i + 1),
                            'action': str(remedy.get('action', '')),
                            'timeframe': str(remedy.get('timeframe', 'As needed'))
                        })
                
                disease_name = data.get('disease') or 'Uncertain Condition'
                conf, conf_valid = validate_confidence(data.get('confidence'))
                severity = determine_disease_severity(disease_name, data.get('severity'))
                
                return {
                    'plant_name': data.get('plant_name') or 'Unknown Plant',
                    'disease': disease_name,
                    'confidence': conf if conf_valid else 75,
                    'severity': severity,
                    'description': data.get('description') or 'Local LLM visual analysis completed.',
                    'remedies': remedies_formatted,
                    'seasonal_tips': f"Monitor {data.get('plant_name', 'foliage')} regularly for healthy development.",
                    'source': 'Local LLM Studio',
                    'model': LOCAL_LLM_MODEL,
                    'is_mock': False
                }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Local LLM JSON: {e}")
            _set_provider_error('local', 'json_parse_failed')
            return None
            
    except requests.exceptions.RequestException as e:
        logger.warning(f"Local LLM Studio not available: {e}")
        _set_provider_error('local', 'request_exception')
        return None
    except Exception as e:
        logger.exception(f"Local LLM error: {e}")
        _set_provider_error('local', 'unexpected_error')
        return None

# ----------------------------------------------------------------------------
# Hugging Face Inference API Integration (Cloud-based, No Download)
# ----------------------------------------------------------------------------
def analyze_with_huggingface_api(image_bytes: bytes) -> Optional[dict]:
    """
    Analyze plant image using Hugging Face Inference API.
    Uses specialized plant disease detection model without downloading it.
    """
    try:
        _clear_provider_error('hf')
        
        if not HUGGINGFACE_API_KEY:
            logger.warning("Hugging Face API key not configured")
            _set_provider_error('hf', 'missing_huggingface_api_key')
            return None
            
        logger.info(f"Analyzing with Hugging Face Inference API: {HUGGINGFACE_MODEL}")
        
        headers = {
            "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
            "x-use-cache": "false"
        }
        
        # Modern Hugging Face Inference API uses router.huggingface.co/hf-inference/models/
        api_url = f"https://router.huggingface.co/hf-inference/models/{HUGGINGFACE_MODEL}"
        try:
            response = requests.post(
                api_url,
                headers=headers,
                data=image_bytes,
                timeout=HUGGINGFACE_TIMEOUT_SECONDS
            )
        except requests.exceptions.RequestException as net_err:
            # Fallback to legacy endpoint if router is unreachable
            fallback_url = f"https://api-inference.huggingface.co/models/{HUGGINGFACE_MODEL}"
            try:
                response = requests.post(
                    fallback_url,
                    headers=headers,
                    data=image_bytes,
                    timeout=HUGGINGFACE_TIMEOUT_SECONDS
                )
            except requests.exceptions.RequestException:
                raise net_err
        
        if response.status_code == 503:
            logger.warning("Model is loading on Hugging Face servers, please wait...")
            _set_provider_error('hf', 'model_loading_503')
            return None
        
        if response.status_code != 200:
            logger.error(f"Hugging Face API error: {response.status_code} - {response.text}")
            _set_provider_error('hf', f'http_{response.status_code}')
            return None
        
        result = response.json()
        logger.debug(f"Hugging Face API response: {result}")
        
        if isinstance(result, list) and len(result) > 0:
            top_prediction = result[0]
            disease_label = top_prediction.get('label', 'Unknown')
            raw_score = top_prediction.get('score', 0)
            confidence, conf_valid = validate_confidence(raw_score)
            if not conf_valid:
                confidence = 0
            
            if '__' in disease_label:
                parts = disease_label.split('__')
                plant_name = parts[0].replace('_', ' ')
                disease_name = parts[1].replace('_', ' ')
            else:
                plant_name = "Plant"
                disease_name = disease_label.replace('_', ' ')
            
            is_healthy = 'healthy' in disease_name.lower()
            
            if is_healthy:
                severity = 'low'
                description = f"The {plant_name.lower()} displays healthy foliage with no visible pathological infection."
                remedies = [
                    {'step': 1, 'action': "Maintain balanced watering allowing topsoil aeration between cycles", 'timeframe': 'Ongoing'},
                    {'step': 2, 'action': "Ensure optimal ambient light exposure suitable for species", 'timeframe': 'Daily'},
                    {'step': 3, 'action': "Inspect foliage weekly for early identification of pests or environmental stress", 'timeframe': 'Weekly'}
                ]
            else:
                # Severity is determined by pathology rules, NOT confidence
                severity = determine_disease_severity(disease_name)
                description = f"Detected foliar symptoms consistent with {disease_name} in {plant_name.lower()}."
                remedies = [
                    {'step': 1, 'action': f"Isolate {plant_name.lower()} from neighboring plants to limit transmission", 'timeframe': 'Immediately'},
                    {'step': 2, 'action': "Prune severely affected, necrotic leaves using sterilized shears", 'timeframe': 'Within 24-48 hours'},
                    {'step': 3, 'action': "Water strictly at the soil base to avoid leaf dampness, and improve air circulation", 'timeframe': 'Ongoing'},
                    {'step': 4, 'action': "If condition progresses or symptoms are ambiguous, verify with close-up inspection before applying targeted treatments", 'timeframe': 'Monitor 3-5 days'}
                ]
            
            return {
                'plant_name': plant_name,
                'disease': 'Healthy' if is_healthy else disease_name,
                'confidence': confidence,
                'severity': severity,
                'description': description,
                'remedies': remedies,
                'seasonal_tips': f"Monitor {plant_name.lower()} regularly for early symptom detection and consistent hydration.",
                'source': 'Hugging Face Inference API',
                'provider': 'hf',
                'model': HUGGINGFACE_MODEL,
                'is_mock': False
            }
        
        logger.warning("Unexpected Hugging Face API response format")
        _set_provider_error('hf', 'unexpected_response_format')
        return None
        
    except requests.exceptions.Timeout:
        logger.error("Hugging Face API timeout")
        _set_provider_error('hf', 'timeout')
        return None
    except Exception as e:
        logger.exception(f"Hugging Face API error: {e}")
        _set_provider_error('hf', 'unexpected_error')
        return None

# ----------------------------------------------------------------------------
# LLaVA Integration (Local Model - Optional, causes download)
# ----------------------------------------------------------------------------
_llava_model = None
_llava_processor = None

def _get_llava_model():
    global _llava_model, _llava_processor
    if _llava_model is None:
        logger.info(f"Loading LLaVA model: {LLAVA_MODEL_ID}...")
        try:
            _llava_processor = AutoProcessor.from_pretrained(LLAVA_MODEL_ID)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            dtype = torch.float16 if device == "cuda" else torch.float32
            logger.info(f"Loading LLaVA on {device} with {dtype}")
            
            _llava_model = LlavaForConditionalGeneration.from_pretrained(
                LLAVA_MODEL_ID, 
                torch_dtype=dtype, 
                low_cpu_mem_usage=True
            ).to(device)
            
            logger.info("LLaVA loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load LLaVA: {e}")
            raise e
    return _llava_processor, _llava_model

def analyze_with_llava(image_bytes: bytes) -> Optional[dict]:
    """Run visual analysis using LLaVA-7B."""
    try:
        import io
        import json
        processor, model = _get_llava_model()
        device = model.device

        raw_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        prompt_text = (
            "Analyze this plant leaf image. Identify: 1. Plant Name 2. Disease (or Healthy) 3. Description of symptoms 4. Remedies. "
            "Output valid JSON without markdown: "
            "{\"plant_name\": \"name\", \"disease\": \"disease or Healthy\", \"confidence\": 85, \"severity\": \"critical|high|medium|low|uncertain\", \"description\": \"text\", \"remedies\": [{\"step\": 1, \"action\": \"text\", \"timeframe\": \"text\"}]}"
        )

        conversation = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {"type": "image"},
                ],
            },
        ]
        
        prompt = processor.apply_chat_template(conversation, add_generation_prompt=True)
        inputs = processor(images=raw_image, text=prompt, return_tensors='pt').to(device, model.dtype)

        logger.info("Running LLaVA inference...")
        output = model.generate(**inputs, max_new_tokens=400, do_sample=False)
        decoded_text = processor.decode(output[0][2:], skip_special_tokens=True).strip()
        logger.debug(f"LLaVA Raw Output: {decoded_text}")
        
        try:
            start = decoded_text.find('{')
            end = decoded_text.rfind('}') + 1
            if start != -1 and end != -1:
                json_str = decoded_text[start:end]
                data = json.loads(json_str)
                
                remedies_list = data.get('remedies', [])
                remedies_formatted = []
                if isinstance(remedies_list, list):
                    for i, r in enumerate(remedies_list):
                        if isinstance(r, str):
                            remedies_formatted.append({'step': i+1, 'action': r, 'timeframe': 'As needed'})
                        elif isinstance(r, dict):
                            remedies_formatted.append({
                                'step': r.get('step', i+1),
                                'action': str(r.get('action', '')),
                                'timeframe': str(r.get('timeframe', 'As needed'))
                            })
                
                disease_name = data.get('disease') or 'Uncertain Condition'
                conf, conf_valid = validate_confidence(data.get('confidence'))
                severity = determine_disease_severity(disease_name, data.get('severity'))
                
                return {
                    'plant_name': data.get('plant_name') or 'Unknown Plant',
                    'disease': disease_name,
                    'confidence': conf if conf_valid else 75,
                    'severity': severity,
                    'description': data.get('description') or decoded_text,
                    'remedies': remedies_formatted,
                    'seasonal_tips': f"Care for {data.get('plant_name', 'your plant')} with adequate light and airflow.",
                    'source': 'LLaVA Visual Model',
                    'model': LLAVA_MODEL_ID,
                    'is_mock': False
                }
        except Exception as e:
            logger.warning(f"LLaVA JSON parse failed: {e}")
        
        return {
            'plant_name': 'Unknown Plant',
            'disease': 'Uncertain Condition',
            'confidence': 50,
            'severity': 'uncertain',
            'description': decoded_text or 'Visual inspection was ambiguous. Please submit a clearer image.',
            'remedies': [
                {'step': 1, 'action': 'Retake image under bright, diffused light focusing on leaf symptoms', 'timeframe': 'Before retry'}
            ],
            'seasonal_tips': 'Refer to visual symptom guidelines.',
            'source': 'LLaVA Visual Model',
            'model': LLAVA_MODEL_ID,
            'is_mock': False
        }

    except Exception as e:
        logger.exception(f"LLaVA inference failed: {e}")
        return None


def analyze_with_gemini(api_key: str, model: str, image_bytes: bytes, mime: str) -> Optional[dict]:
    """Use Google Gemini to analyze the image and return normalized schema."""
    try:
        _clear_provider_error('gemini')
        import google.generativeai as genai
        logger.info(f"Configuring Gemini with model '{model}' (REST transport)")
        genai.configure(api_key=api_key, transport="rest")
        m = genai.GenerativeModel(model)
        
        prompt = (
            "You are an expert botanist and plant pathologist. "
            "Perform a rigorous diagnostic assessment of this plant leaf photograph.\n\n"
            "DIAGNOSTIC GUIDELINES:\n"
            "1. BOTANICAL IDENTIFICATION: Identify plant species (common name + botanical name where discernible)\n"
            "2. PATHOLOGY EVALUATION: Differentiate true pathogens (fungal/bacterial/viral/pest) from physiological stress (sunburn, nutrient deficiency, underwatering)\n"
            "3. SEVERITY ASSESSMENT: Evaluate condition severity based on biological impact (critical=life threatening/rapid rot, high=systemic/fast spreading, medium=localized/chronic, low=minor/healthy)\n"
            "4. EVIDENCE-BASED CARE: Recommend conservative, practical steps for home gardeners. Do not prescribe harsh chemicals or fungicides when sanitation, watering adjustment, or aeration is sufficient.\n"
            "5. UNCERTAINTY: If symptoms are ambiguous or the photo is unclear, explicitly indicate uncertainty in the diagnosis and suggest visual checks (leaf underside, stem base).\n\n"
            "OUTPUT FORMAT - Respond ONLY with valid JSON (no markdown fences, no extra text):\n"
            "{\n"
            "  \"plant_name\": \"Common Name (Botanical Name)\",\n"
            "  \"disease\": \"Specific Condition Name or 'Healthy'\",\n"
            "  \"confidence\": 85,\n"
            "  \"severity\": \"critical|high|medium|low|uncertain\",\n"
            "  \"description\": \"Detailed 3-5 sentence clinical observation describing visible foliar lesions, pattern, and probable cause.\",\n"
            "  \"remedies\": [\n"
            "    {\"step\": 1, \"action\": \"Clear, practical action step\", \"timeframe\": \"Timeline e.g. Immediately\"},\n"
            "    {\"step\": 2, \"action\": \"Follow-up cultural adjustment\", \"timeframe\": \"Timeline e.g. Next 3-5 days\"}\n"
            "  ],\n"
            "  \"seasonal_tips\": \"Seasonal maintenance recommendation specific to this specimen (2-3 sentences).\",\n"
            "  \"prescribed_care\": {\n"
            "    \"overview\": \"Clear overview of condition cause, recovery timeline, and prognosis.\",\n"
            "    \"immediate_actions\": [\"Step 1\", \"Step 2\", \"Step 3\"],\n"
            "    \"treatment_schedule\": [\n"
            "      {\"week\": \"Week 1\", \"actions\": [\"Action 1\", \"Action 2\"]},\n"
            "      {\"week\": \"Week 2\", \"actions\": [\"Action 1\", \"Action 2\"]}\n"
            "    ],\n"
            "    \"environmental_improvements\": [\"Airflow\", \"Humidity\", \"Drainage\"],\n"
            "    \"prevention\": [\"Practice 1\", \"Practice 2\"]\n"
            "  }\n"
            "}"
        )
        parts = [
            {"mime_type": mime or "image/jpeg", "data": image_bytes},
            prompt,
        ]
        logger.info("Calling Gemini generate_content with structured diagnostic prompt...")
        resp = m.generate_content(
            parts,
            request_options={"timeout": GEMINI_TIMEOUT_SECONDS},
            generation_config={"response_mime_type": "application/json"}
        )
        
        text = getattr(resp, 'text', None)
        if not text:
            text = getattr(resp, 'candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        
        logger.info(f"Gemini response length: {len(text) if text else 0}")
        
        if not text:
            logger.warning("Gemini returned empty text")
            _set_provider_error('gemini', 'empty_response')
            return None
        
        try:
            import json as _json
            normalized_text = text.strip().replace('```json', '').replace('```', '').strip()
            data = _json.loads(normalized_text)
            
            if isinstance(data, dict):
                plant_name = data.get('plant_name') or 'Unknown Plant'
                disease = data.get('disease') or 'Uncertain Condition'
                conf, conf_valid = validate_confidence(data.get('confidence'))
                if not conf_valid:
                    conf = 70
                severity = determine_disease_severity(disease, data.get('severity'))
                
                # Normalize remedies to remove any fabricated effectiveness numbers
                remedies_raw = data.get('remedies', [])
                remedies = []
                if isinstance(remedies_raw, list):
                    for idx, rem in enumerate(remedies_raw, 1):
                        if isinstance(rem, dict):
                            remedies.append({
                                'step': rem.get('step', idx),
                                'action': str(rem.get('action', '')),
                                'timeframe': str(rem.get('timeframe', 'As needed'))
                            })
                        elif isinstance(rem, str):
                            remedies.append({
                                'step': idx,
                                'action': rem,
                                'timeframe': 'As needed'
                            })
                
                normalized = {
                    'plant_name': plant_name,
                    'disease': disease,
                    'confidence': conf,
                    'severity': severity,
                    'description': data.get('description') or 'Gemini botanical analysis complete.',
                    'remedies': remedies,
                    'seasonal_tips': data.get('seasonal_tips') or '',
                    'prescribed_care': data.get('prescribed_care') if isinstance(data.get('prescribed_care'), dict) else {},
                    'source': 'Google Gemini',
                    'provider': 'gemini',
                    'model': model,
                    'is_mock': False
                }
                logger.info(f"Gemini response parsed successfully: plant='{plant_name}', disease='{disease}', confidence={conf}, severity='{severity}'")
                return normalized

            logger.warning("Gemini response JSON is not an object")
            _set_provider_error('gemini', 'json_not_object')
            return None
        except Exception as e:
            try:
                import json as _json
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end > start:
                    extracted = text[start:end]
                    data = _json.loads(extracted)
                    if isinstance(data, dict):
                        d_name = data.get('disease') or 'Uncertain Condition'
                        conf, _ = validate_confidence(data.get('confidence'))
                        return {
                            'plant_name': data.get('plant_name') or 'Unknown Plant',
                            'disease': d_name,
                            'confidence': conf if conf is not None else 65,
                            'severity': determine_disease_severity(d_name, data.get('severity')),
                            'description': data.get('description') or 'Gemini returned a partial response.',
                            'remedies': [],
                            'seasonal_tips': data.get('seasonal_tips') or '',
                            'prescribed_care': {},
                            'source': 'Google Gemini',
                            'model': model,
                            'is_mock': False
                        }
            except Exception:
                pass

            logger.exception(f'Gemini JSON parse failed: {e}')
            _set_provider_error('gemini', 'json_parse_failed')
            return None
    except Exception as e:
        logger.exception(f'Gemini API call failed: {e}')
        error_text = str(e).lower()
        if any(token in error_text for token in ('429', 'quota', 'rate limit', 'resource exhausted')):
            _set_provider_error('gemini', 'quota_exceeded')
        else:
            _set_provider_error('gemini', 'api_call_failed')
        return None


# Request/Response Logging
# ----------------------------------------------------------------------------
@app.before_request
def _start_timer():
    request._start_time = time.perf_counter()


@app.after_request
def _log_request(response):
    try:
        # Apply security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)
        response = add_security_headers(response)

        # Add CORS headers
        origin = request.headers.get('Origin')
        if origin and _is_allowed_origin(origin):
            if CORS_ORIGINS == ['*']:
                response.headers['Access-Control-Allow-Origin'] = '*'
            else:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, X-API-Key'
                response.headers['Access-Control-Max-Age'] = '3600'
                response.headers['Vary'] = 'Origin'
        
        # Log request safely without sensitive body or credentials
        duration_ms = None
        if hasattr(request, '_start_time'):
            duration_ms = int((time.perf_counter() - request._start_time) * 1000)
        logger.info(
            f"{request.remote_addr} | {request.method} {request.path} | "
            f"{response.status_code} | {duration_ms}ms"
        )
    except Exception:
        pass
    return response


@app.errorhandler(RateLimitExceeded)
def handle_rate_limit(e):
    logger.warning(f"Rate limit exceeded for client: {e.message}")
    response = jsonify({
        'error': 'Rate limit exceeded',
        'message': str(e),
        'retry_after': e.retry_after
    })
    response.headers['Retry-After'] = str(e.retry_after)
    return response, 429



# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------
@app.get('/')
def index():
    return jsonify({
        'message': 'Welcome to Plant Care AI API',
        'status': 'running',
        'docs': '/api/diseases',
        'health': '/api/health'
    })

@app.get('/api/health')
def health():
    configured_real_providers = []
    if GEMINI_API_KEY:
        configured_real_providers.append('gemini')
    if HUGGINGFACE_API_KEY:
        configured_real_providers.append('hf')

    return jsonify({
        'status': 'healthy',
        'service': 'Plant Disease Detection API',
        'time': datetime.utcnow().isoformat() + 'Z',
        'ai': {
            'provider_order': PROVIDER_ORDER,
            'configured_real_providers': configured_real_providers,
            'mock_fallback_enabled': ALLOW_MOCK_FALLBACK,
            'gemini_model': GEMINI_MODEL,
            'ready_for_real_analysis': len(configured_real_providers) > 0
        }
    })


def fetch_weather_info(location=None) -> dict:
    """Fetch current weather data or clearly flagged estimated baseline."""
    if not location:
        location = DEFAULT_LOCATION
    
    # Regional meteorological baseline (clearly flagged as estimated fallback)
    fallback_data = {
        'location': f'{location} (Estimated Baseline)',
        'temperature': 28.5,
        'feels_like': 30.2,
        'humidity': 65,
        'pressure': 1013,
        'description': 'Partly cloudy (Historical Regional Average)',
        'wind_speed': 12.5,
        'rainfall': 0.0,
        'cloudiness': 40,
        'sunrise': '06:45',
        'sunset': '18:30',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'source': 'Regional Climate Baseline',
        'is_estimated': True,
        'is_fallback': True,
        'note': 'Using estimated regional baseline data. Configure OPENWEATHER_API_KEY in server environment for live local weather.'
    }
    
    if not OPENWEATHER_API_KEY:
        return fallback_data
    
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            'q': location,
            'appid': OPENWEATHER_API_KEY,
            'units': 'metric'
        }
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        return {
            'location': f"{data.get('name', 'Unknown')}, {data.get('sys', {}).get('country', '')}".strip(', '),
            'temperature': round(float(data.get('main', {}).get('temp', 25.0)), 1),
            'feels_like': round(float(data.get('main', {}).get('feels_like', 25.0)), 1),
            'humidity': int(data.get('main', {}).get('humidity', 50)),
            'pressure': int(data.get('main', {}).get('pressure', 1013)),
            'description': data.get('weather', [{}])[0].get('description', 'Clear').capitalize(),
            'wind_speed': round(float(data.get('wind', {}).get('speed', 0.0)) * 3.6, 1),
            'rainfall': float(data.get('rain', {}).get('1h', 0.0)),
            'cloudiness': int(data.get('clouds', {}).get('all', 0)),
            'sunrise': datetime.fromtimestamp(data.get('sys', {}).get('sunrise', 0)).strftime('%H:%M') if data.get('sys', {}).get('sunrise') else '--',
            'sunset': datetime.fromtimestamp(data.get('sys', {}).get('sunset', 0)).strftime('%H:%M') if data.get('sys', {}).get('sunset') else '--',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'source': 'OpenWeatherMap API',
            'is_estimated': False,
            'is_fallback': False
        }
    except Exception as e:
        logger.warning(f"Weather API fetch failed: {e}. Utilizing estimated baseline.")
        return fallback_data


@app.get('/api/environment/weather')
def get_weather_data():
    """Get weather data for a location."""
    location = request.args.get('location', DEFAULT_LOCATION)
    return jsonify(fetch_weather_info(location))


def fetch_soil_info(lat=None, lon=None) -> dict:
    """
    Get soil data for a location using SoilHive API or other configured soil provider.
    Distinguishes live external sensor/gridded data from unmeasured estimates.
    """
    try:
        lat = float(lat if lat is not None else DEFAULT_LATITUDE)
        lon = float(lon if lon is not None else DEFAULT_LONGITUDE)
        
        # Validate coordinates bounds
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            lat = DEFAULT_LATITUDE
            lon = DEFAULT_LONGITUDE
            
        if SOIL_API_KEY:
            try:
                is_soilhive = 'soilhive.ag' in SOIL_API_URL.lower()
                
                if is_soilhive:
                    endpoint_url = SOIL_API_URL.rstrip('/')
                    if not endpoint_url.endswith('/soil-data-by-geometry'):
                        endpoint_url = f"{endpoint_url}/soil-data-by-geometry"
                    
                    headers = {
                        'Authorization': f'Bearer {SOIL_API_KEY}',
                        'Content-Type': 'application/json',
                        'Accept': 'application/ld+json, application/json'
                    }
                    
                    payload = {
                        'geometry': f'POINT ({lon} {lat})',
                        'datasets': [19]  # SoilGrids global dataset
                    }
                    
                    response = requests.post(
                        endpoint_url,
                        headers=headers,
                        json=payload,
                        timeout=15
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        feed_elements = data.get('dataFeedElement', [])
                        extracted = {}
                        
                        for elem in feed_elements:
                            items = elem.get('item', [])
                            prop_name = None
                            prop_val = None
                            for it in items:
                                name = it.get('name')
                                val = it.get('value')
                                if name == 'Property':
                                    prop_name = str(val).lower()
                                elif name == 'Value':
                                    prop_val = val
                            if prop_name and prop_val is not None:
                                try:
                                    extracted[prop_name] = float(prop_val)
                                except (ValueError, TypeError):
                                    extracted[prop_name] = prop_val
                        
                        raw_ph = extracted.get('phh2o', extracted.get('ph', extracted.get('soil_ph', 6.8)))
                        if isinstance(raw_ph, (int, float)) and raw_ph > 14:
                            raw_ph = round(raw_ph / 10.0, 1)
                        
                        clay = extracted.get('clay', 30)
                        sand = extracted.get('sand', 40)
                        silt = extracted.get('silt', 30)
                        texture = determine_soil_texture(clay, sand, silt) if isinstance(clay, (int, float)) and isinstance(sand, (int, float)) and isinstance(silt, (int, float)) else 'Clay Loam'
                        
                        soc = extracted.get('soc', extracted.get('soc_mean', extracted.get('soil_organic_carbon', 2.1)))
                        organic_matter_pct = round(soc / 10.0, 1) if isinstance(soc, (int, float)) and soc > 10 else round(float(soc), 1)
                        
                        nitrogen_val = extracted.get('nitrogen', extracted.get('soil_nitrogen'))
                        phosphorus_val = extracted.get('phosphorus', extracted.get('soil_phosphorous'))
                        potassium_val = extracted.get('potassium', extracted.get('soil_potassium'))
                        
                        soil_results = {
                            'ph': raw_ph,
                            'nitrogen': classify_nutrient_value(nitrogen_val, 'nitrogen') if isinstance(nitrogen_val, (int, float)) else 'Medium',
                            'phosphorus': classify_nutrient_value(phosphorus_val, 'phosphorus') if isinstance(phosphorus_val, (int, float)) else 'Medium',
                            'potassium': classify_nutrient_value(potassium_val, 'potassium') if isinstance(potassium_val, (int, float)) else 'Medium',
                            'organic_matter': f"{organic_matter_pct}%",
                            'texture': texture,
                            'moisture': f"{int(extracted['moisture'])}%" if 'moisture' in extracted else None,
                            'temperature': extracted.get('soil_temperature'),
                            'source': 'SoilHive Global Grids',
                            'coordinates': {'lat': lat, 'lon': lon},
                            'is_estimated': False,
                            'is_fallback': False,
                            'timestamp': datetime.utcnow().isoformat() + 'Z'
                        }
                        logger.info(f"Soil data retrieved from SoilHive API for ({lat}, {lon})")
                        return soil_results
                    elif response.status_code in (401, 403):
                        logger.error(f"SoilHive API authentication failed ({response.status_code})")
                    else:
                        logger.warning(f"SoilHive API returned status {response.status_code}")
                
                else:
                    headers = {
                        'x-api-key': SOIL_API_KEY,
                        'Authorization': f'Bearer {SOIL_API_KEY}',
                        'Content-Type': 'application/json'
                    }
                    params = {'lat': lat, 'lng': lon}
                    response = requests.get(SOIL_API_URL, headers=headers, params=params, timeout=15)
                    if response.status_code == 200:
                        data = response.json()
                        soil_data = data.get('data', [{}])[0] if isinstance(data.get('data'), list) else data.get('data', {})
                        soil_results = {
                            'ph': soil_data.get('soil_ph', 6.8),
                            'nitrogen': classify_nutrient_value(soil_data.get('soil_nitrogen', 20), 'nitrogen'),
                            'phosphorus': classify_nutrient_value(soil_data.get('soil_phosphorous', 15), 'phosphorus'),
                            'potassium': classify_nutrient_value(soil_data.get('soil_potassium', 180), 'potassium'),
                            'organic_matter': f"{soil_data.get('soil_organic_carbon', 2.1)}%",
                            'texture': soil_data.get('soil_texture', 'Clay Loam'),
                            'moisture': f"{soil_data.get('soil_moisture')}%" if soil_data.get('soil_moisture') is not None else None,
                            'temperature': soil_data.get('soil_temperature'),
                            'source': 'Soil API',
                            'coordinates': {'lat': lat, 'lon': lon},
                            'is_estimated': False,
                            'is_fallback': False,
                            'timestamp': datetime.utcnow().isoformat() + 'Z'
                        }
                        return soil_results
            except requests.exceptions.RequestException as e:
                logger.warning(f"Soil API request failed: {e}")
        
        # Transparent estimated baseline when live soil provider is unavailable
        soil_results = {
            'ph': None,
            'nitrogen': None,
            'phosphorus': None,
            'potassium': None,
            'organic_matter': None,
            'texture': 'Reference Loam',
            'moisture': None,
            'temperature': None,
            'source': 'Regional Reference Estimate (Unmeasured)',
            'coordinates': {'lat': lat, 'lon': lon},
            'is_estimated': True,
            'is_fallback': True,
            'note': 'Live soil sensor or API not active for this plot. Moisture and pH require physical testing or an active SOIL_API_KEY.',
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
        return soil_results
        
    except Exception as e:
        logger.exception(f"Unexpected error fetching soil data: {e}")
        return {
            'ph': None,
            'nitrogen': None,
            'phosphorus': None,
            'potassium': None,
            'organic_matter': None,
            'texture': 'Reference Loam',
            'moisture': None,
            'temperature': None,
            'source': 'Regional Reference Estimate (Unmeasured)',
            'coordinates': {'lat': DEFAULT_LATITUDE, 'lon': DEFAULT_LONGITUDE},
            'is_estimated': True,
            'is_fallback': True,
            'note': 'Unavailable due to service interruption.',
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }


@app.get('/api/environment/soil')
def get_soil_data():
    """Get soil data for a location using SoilHive API or fallback."""
    try:
        lat = float(request.args.get('lat', DEFAULT_LATITUDE))
        lon = float(request.args.get('lon', DEFAULT_LONGITUDE))
    except (ValueError, TypeError):
        lat = DEFAULT_LATITUDE
        lon = DEFAULT_LONGITUDE
    return jsonify(fetch_soil_info(lat, lon))


def determine_soil_texture(clay_pct: float, sand_pct: float, silt_pct: float) -> str:
    """Determine soil texture based on USDA classification."""
    if clay_pct >= 40:
        return 'Clay'
    elif clay_pct >= 27 and sand_pct >= 20 and sand_pct < 45:
        return 'Clay Loam'
    elif clay_pct >= 20 and clay_pct < 35 and silt_pct >= 15 and sand_pct < 45:
        return 'Loam'
    elif sand_pct >= 85:
        return 'Sand'
    elif sand_pct >= 70 and sand_pct < 90:
        return 'Loamy Sand'
    elif silt_pct >= 80:
        return 'Silt'
    elif silt_pct >= 50 and clay_pct < 27:
        return 'Silt Loam'
    else:
        return 'Loam'


def classify_nutrient_level(data: dict, nutrient: str) -> str:
    return 'Medium'


def classify_nutrient_value(value: Optional[float], nutrient_type: str) -> str:
    """Classify nutrient value as Low, Medium, or High."""
    if value is None:
        return 'Unknown'
    if nutrient_type == 'nitrogen':
        if value < 20:
            return 'Low'
        elif value <= 40:
            return 'Medium'
        else:
            return 'High'
    elif nutrient_type == 'phosphorus':
        if value < 10:
            return 'Low'
        elif value <= 25:
            return 'Medium'
        else:
            return 'High'
    elif nutrient_type == 'potassium':
        if value < 110:
            return 'Low'
        elif value <= 280:
            return 'Medium'
        else:
            return 'High'
    return 'Medium'


def calculate_watering_schedule_backend(weather: dict, soil: dict, plant_name: str = "", disease: str = "", severity: str = "", plant_location: str = "outdoor") -> dict:
    """
    Calculate adaptive watering schedule combining weather, soil, location, and disease context.
    Clearly distinguishes measured parameters from evaporative estimates.
    """
    temp = float(weather.get('temperature', 28.5))
    humidity = float(weather.get('humidity', 60.0))
    rainfall = float(weather.get('rainfall', 0.0))
    wind_speed = float(weather.get('wind_speed', 12.0))
    
    # Check whether soil moisture was directly measured or is unmeasured
    moisture_val = soil.get('moisture')
    has_measured_moisture = moisture_val is not None
    
    if has_measured_moisture:
        try:
            moisture = float(str(moisture_val).replace('%', '').strip())
        except (ValueError, TypeError):
            moisture = 45.0
            has_measured_moisture = False
    else:
        moisture = 45.0  # nominal baseline for evaporative calculation only
        
    texture = str(soil.get('texture') or 'Loam')
    ph = soil.get('ph')
    
    disease_lower = (disease or '').lower()
    is_fungal = any(k in disease_lower for k in ['mildew', 'blight', 'rust', 'rot', 'spot', 'mold', 'fung', 'scab'])
    is_root_rot = 'rot' in disease_lower or 'damping' in disease_lower
    is_indoor = str(plant_location or '').lower() in ('indoor', 'indoors', 'pot', 'container_indoor', 'houseplant')
    is_clay = 'clay' in texture.lower()
    is_sand = 'sand' in texture.lower()
    
    # Evaporative demand estimate (mm/day)
    et_rate = round(max(1.8, min(8.5, (max(0, temp - 15) * 0.18) + (max(0, 100 - humidity) * 0.04) + (wind_speed * 0.05))), 1)
    
    if is_root_rot:
        today_action = "Halt All Watering Immediately"
        status = "critical"
        best_time = "Do Not Irrigate"
        volume = "0 mm"
        technique = "Dry-down cycle: Aerate root zone and withhold water"
        rationale = "Root rot pathogen thrives in waterlogged conditions. Withhold irrigation to allow root system aeration and callusing."
    elif rainfall >= 3.0 and not is_indoor:
        today_action = "Skip Watering (Recent Outdoor Rain Sufficient)"
        status = "delay"
        best_time = "Hold for 24-48 hours"
        volume = "0 mm"
        technique = "Monitor bed drainage"
        rationale = f"Recent outdoor rainfall ({rainfall} mm) provides sufficient soil moisture for outdoor plantings."
    elif is_indoor and rainfall >= 3.0:
        today_action = "Water at Soil Base If Dry (Indoor Specimen)"
        status = "optimal"
        best_time = "Morning (07:00 - 09:00 AM)"
        volume = "10-15 mm (~300-500ml)"
        technique = "Base/Drip watering only"
        rationale = f"Outdoor rain ({rainfall} mm) does not directly hydrate indoor containers. Check topsoil with finger test before watering."
    elif has_measured_moisture and moisture >= 62.0:
        today_action = "Skip Watering (High Soil Moisture)"
        status = "delay"
        best_time = "Recheck tomorrow morning"
        volume = "0 mm"
        technique = "Surface aeration check"
        rationale = f"Direct sensor reading shows elevated soil moisture ({moisture}%). Delay watering to prevent root oxygen deprivation."
    elif has_measured_moisture and moisture < 32.0:
        today_action = "Deep Root Watering Recommended"
        status = "urgent"
        best_time = "Early Morning (06:00 - 07:30 AM)"
        volume = "20-25 mm" if is_clay else "15-20 mm"
        technique = "Basal / Drip line only (strictly keep leaves dry)" if is_fungal else "Deep soak around root zone"
        rationale = f"Soil moisture has dropped to {moisture}% under {temp}°C conditions. Apply deep root-zone irrigation early."
    else:
        # Standard evaporative calculation
        if temp >= 30 and humidity < 50:
            today_action = "Morning Irrigation Recommended (High Evaporative Demand)"
            status = "optimal"
            best_time = "06:30 - 08:00 AM"
            volume = "15-18 mm"
            technique = "Drip / base irrigation (keep leaves dry)" if is_fungal else "Standard root hydration"
            rationale = f"High evaporative demand (ET rate {et_rate} mm/day, {temp}°C). Hydrate soil base early before peak heat."
        else:
            today_action = "Moderate Hydration — Check Topsoil First"
            status = "optimal"
            best_time = "07:00 - 08:30 AM"
            volume = "10-14 mm"
            technique = "Base watering at soil line"
            rationale = f"Moderate ambient temperatures ({temp}°C, {humidity}% humidity). Verify top 1-2 inches of soil is dry before watering."
        
    disease_rules = []
    if is_fungal:
        disease_rules.append("Foliar Precaution: Never overhead water or mist foliage. Water strictly at soil base to inhibit spore germination.")
        disease_rules.append("Timing Constraint: Avoid evening watering. Overnight foliar dampness facilitates fungal progression.")
    if is_root_rot:
        disease_rules.append("Drainage Requirement: Verify container drainage holes are clear; never allow standing water in drip trays.")
    if is_indoor:
        disease_rules.append("Microclimate Note: Indoor plants are isolated from outdoor rainfall and wind; always check soil feel manually.")
        
    interval = 2 if is_sand else (4 if is_clay else 3)
    if is_fungal or is_root_rot:
        interval += 1
        
    seven_day = []
    for i in range(1, 8):
        if i == 1:
            act = today_action if status in ('urgent', 'optimal') else "Rest / Aerate"
            tp = "water" if status in ('urgent', 'optimal') else "skip"
            tm = best_time if tp == "water" else "Hold"
            vol = volume if tp == "water" else "0 mm"
        elif is_root_rot and i < 4:
            act = "Complete Dry-Down"
            tp = "skip"
            tm = "--"
            vol = "0 mm"
        elif (i - 1) % interval == 0:
            act = "Scheduled Irrigation"
            tp = "water"
            tm = "06:30 - 08:00 AM"
            vol = "18-22 mm" if is_clay else ("12-15 mm" if is_sand else "15-18 mm")
        elif (i - 1) % interval == 1:
            act = "Inspect Soil Moisture"
            tp = "check"
            tm = "Morning check"
            vol = "0 mm"
        else:
            act = "Aeration Cycle"
            tp = "skip"
            tm = "--"
            vol = "0 mm"
            
        seven_day.append({
            'day': f"Day {i}",
            'action': act,
            'type': tp,
            'time_window': tm,
            'volume': vol
        })
        
    return {
        'today': {
            'action': today_action,
            'status': status,
            'best_time': best_time,
            'volume': volume,
            'technique': technique,
            'rationale': rationale,
            'et_rate': f"{et_rate} mm/day",
            'current_moisture': f"{moisture}%" if has_measured_moisture else "Unmeasured",
            'moisture_measured': has_measured_moisture,
            'soil_texture': texture,
            'soil_ph': ph if ph is not None else "Unmeasured"
        },
        'plant_context': {
            'plant_name': plant_name or 'General Crop',
            'disease': disease or 'Healthy',
            'severity': severity or 'normal',
            'location_type': 'indoor' if is_indoor else 'outdoor'
        },
        'disease_rules': disease_rules,
        'seven_day_schedule': seven_day,
        'freshness': {
            'weather_source': weather.get('source', 'Unknown'),
            'weather_timestamp': weather.get('timestamp'),
            'soil_source': soil.get('source', 'Unknown'),
            'soil_timestamp': soil.get('timestamp')
        }
    }


@app.get('/api/environment/watering-schedule')
def get_watering_schedule():
    """
    Get adaptive watering schedule based on real-time weather,
    SoilHive soil properties, and optional plant disease context.
    Query params: location, lat, lon, plant_name, disease, severity, plant_location
    """
    location = request.args.get('location', DEFAULT_LOCATION)
    try:
        lat = float(request.args.get('lat', DEFAULT_LATITUDE))
        lon = float(request.args.get('lon', DEFAULT_LONGITUDE))
    except (ValueError, TypeError):
        lat = DEFAULT_LATITUDE
        lon = DEFAULT_LONGITUDE
    
    plant_name = request.args.get('plant_name', '')
    disease = request.args.get('disease', '')
    severity = request.args.get('severity', '')
    plant_location = request.args.get('plant_location', 'outdoor')
    
    weather = fetch_weather_info(location)
    soil = fetch_soil_info(lat, lon)
    schedule = calculate_watering_schedule_backend(weather, soil, plant_name, disease, severity, plant_location)
    return jsonify(schedule)


@app.get('/api/diseases')
def list_diseases():
    """List common diseases for reference only."""
    diseases = []
    for key, disease in DISEASE_DATABASE.items():
        diseases.append({
            'id': key,
            'name': disease['name'],
            'severity': disease['severity'],
            'description': disease['description']
        })
    return jsonify(diseases)


@app.route('/api/analyze', methods=['GET', 'POST'])
@rate_limit(limit=int(os.getenv('RATE_LIMIT_PER_MINUTE', 30)), window=60)
def analyze():
    if request.method == 'GET':
        return jsonify({
            'status': 'ok',
            'message': 'Use POST /api/analyze with JSON body: {"image": "data:image/...;base64,..."}'
        }), 200

    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'Malformed JSON payload'}), 400

    image_data = payload.get('image')
    if not image_data or not isinstance(image_data, str):
        return jsonify({'error': 'Missing or invalid "image" field'}), 400

    # Validate image bytes, dimensions, and type securely
    mime, img_bytes, err_msg, status_code = validate_and_decode_image(image_data)
    if err_msg or not img_bytes:
        return jsonify({'error': err_msg or 'Invalid image data'}), status_code

    logger.info(f"Analyze request validated | mime={mime} | bytes={len(img_bytes)}")

    image_hash = analysis_cache.get_image_hash(img_bytes)
    cached_result = analysis_cache.get(image_hash)
    if cached_result:
        logger.info(f"Cache hit! Returning cached result for image {image_hash[:8]}...")
        cached_result['_from_cache'] = True
        return jsonify(cached_result)

    provider_status = {}

    for provider in PROVIDER_ORDER:
        try:
            provider_key = provider.lower()
            logger.info(f"AI Analysis Provider attempt: {provider_key}")
            
            # Local LLM Studio
            if provider_key == 'local':
                result = analyze_with_local_llm(img_bytes)
                if result:
                    logger.info(f"Local LLM analysis successful: {result.get('plant_name')} - {result.get('disease')}")
                    analysis_cache.set(image_hash, result)
                    return jsonify(result)
                provider_status[provider_key] = _get_provider_error('local') or 'failed_or_unavailable'
            
            # Hugging Face Inference API
            if provider_key in ('hf', 'huggingface'):
                if not HUGGINGFACE_API_KEY:
                    provider_status['hf'] = 'missing_huggingface_api_key'
                    continue
                result = analyze_with_huggingface_api(img_bytes)
                if result:
                    logger.info(f"Hugging Face analysis successful: {result.get('plant_name')} - {result.get('disease')}")
                    analysis_cache.set(image_hash, result)
                    return jsonify(result)
                provider_status['hf'] = _get_provider_error('hf') or 'failed_or_unavailable'
            
            # Gemini AI Model
            if provider_key in ('gemini', 'google'):
                if not GEMINI_API_KEY:
                    provider_status['gemini'] = 'missing_gemini_api_key'
                    continue
                result = analyze_with_gemini(GEMINI_API_KEY, GEMINI_MODEL, img_bytes, mime)
                if result:
                    logger.info(f"Gemini AI analysis successful: {result.get('plant_name')} - {result.get('disease')}")
                    analysis_cache.set(image_hash, result)
                    return jsonify(result)
                provider_status['gemini'] = _get_provider_error('gemini') or 'failed_or_unavailable'
            
            # Mock provider (only when explicitly enabled)
            if provider_key == 'mock':
                if not ALLOW_MOCK_FALLBACK:
                    provider_status['mock'] = 'disabled'
                    continue
                logger.warning("Using mock provider - real AI models unavailable or unconfigured")
                mock_result = generate_mock_result()
                mock_result['provider_status'] = provider_status
                return jsonify(mock_result)
                
        except Exception as e:
            provider_status[provider_key] = 'unexpected_error'
            logger.exception(f"Provider '{provider_key}' failed: {e}")

    logger.error("All AI providers failed or not configured")
    if ALLOW_MOCK_FALLBACK:
        mock_result = generate_mock_result()
        mock_result['provider_status'] = provider_status
        return jsonify(mock_result)

    return jsonify({
        'error': 'Real-time analysis is currently unavailable.',
        'details': 'No AI provider could process this image right now. Please retry shortly.',
        'provider_status': provider_status,
        'error_code': 'analysis_unavailable',
        'retryable': True,
        'is_mock': False
    }), 503

    # OPTIMIZATION 1: Check cache first
    image_hash = analysis_cache.get_image_hash(img_bytes)
    cached_result = analysis_cache.get(image_hash)
    if cached_result:
        logger.info(f"✅ Cache hit! Returning cached result for image {image_hash[:8]}...")
        cached_result['_from_cache'] = True
        return jsonify(cached_result)

    # AI-POWERED ANALYSIS: Try AI providers in configured order
    # This uses real-time AI models (Gemini/LLaVA) to analyze the uploaded image
    # NO predefined disease data is used - all analysis is AI-generated
    provider_status = {}

    for provider in PROVIDER_ORDER:
        try:
            provider_key = provider.lower()
            logger.info(f"🤖 AI Analysis Provider attempt: {provider_key}")
            
            # Try Local LLM Studio
            if provider_key == 'local':
                logger.info("Using Local LLM Studio for real-time plant analysis")
                result = analyze_with_local_llm(img_bytes)
                if result:
                    logger.info(f"✅ Local LLM analysis successful: {result.get('plant_name')} - {result.get('disease')}")
                    # Cache the result
                    analysis_cache.set(image_hash, result)
                    return jsonify(result)
                logger.warning("❌ Local LLM analysis returned no result or LLM Studio not running")
                provider_status[provider_key] = _get_provider_error('local') or 'failed_or_unavailable'
            
            # Try Hugging Face Inference API (Specialized Plant Disease Detection)
            if provider_key in ('hf', 'huggingface'):
                if not HUGGINGFACE_API_KEY:
                    provider_status['hf'] = 'missing_huggingface_api_key'
                    logger.warning("Skipping Hugging Face provider: API key not configured")
                    continue
                logger.info("Using Hugging Face Inference API for plant disease detection")
                result = analyze_with_huggingface_api(img_bytes)
                if result:
                    logger.info(f"✅ Hugging Face analysis successful: {result.get('plant_name')} - {result.get('disease')} ({result.get('confidence')}%)")
                    # Cache the result
                    analysis_cache.set(image_hash, result)
                    return jsonify(result)
                logger.warning("❌ Hugging Face Inference API returned no result or model loading")
                provider_status['hf'] = _get_provider_error('hf') or 'failed_or_unavailable'
            
            # Try Gemini AI Model (Google)
            if provider_key in ('gemini', 'google'):
                if not GEMINI_API_KEY:
                    provider_status['gemini'] = 'missing_gemini_api_key'
                    logger.warning("Skipping Gemini provider: API key not configured")
                    continue
                logger.info("Using Gemini AI model for real-time cognitive plant analysis")
                result = analyze_with_gemini(GEMINI_API_KEY, GEMINI_MODEL, img_bytes, mime)
                if result:
                    logger.info(f"✅ Gemini AI analysis successful: {result.get('plant_name')} - {result.get('disease')}")
                    # Cache the result
                    analysis_cache.set(image_hash, result)
                    return jsonify(result)
                logger.warning("❌ Gemini analysis returned no result")
                provider_status['gemini'] = _get_provider_error('gemini') or 'failed_or_unavailable'
            
            # Mock provider (only as configured fallback)
            if provider_key == 'mock':
                if not ALLOW_MOCK_FALLBACK:
                    provider_status['mock'] = 'disabled'
                    logger.warning("Skipping mock provider: ALLOW_MOCK_FALLBACK is false")
                    continue
                logger.warning("⚠️ Using mock provider - AI models unavailable or failed")
                mock_result = generate_mock_result()
                mock_result['provider_status'] = provider_status
                return jsonify(mock_result)
                
        except Exception as e:
            provider_status[provider_key] = 'unexpected_error'
            logger.exception(f"❌ Provider '{provider_key}' failed with error: {e}")
            logger.info("Trying next provider...")

    # Final fallback only when ALL AI providers fail
    logger.error("🚨 CRITICAL: All AI providers failed or not configured!")
    logger.error("Please ensure Gemini API key is set or LLaVA model is available")
    if ALLOW_MOCK_FALLBACK:
        mock_result = generate_mock_result()
        mock_result['provider_status'] = provider_status
        return jsonify(mock_result)

    return jsonify({
        'error': 'Real-time analysis is currently unavailable.',
        'details': 'No AI provider could process this image right now. Please retry shortly.',
        'provider_status': provider_status,
        'error_code': 'analysis_unavailable',
        'retryable': True,
        'is_mock': False
    }), 503


# ----------------------------------------------------------------------------
# Error Handlers
# ----------------------------------------------------------------------------
@app.errorhandler(404)
def handle_404(_):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def handle_500(e):
    logger.exception("Unhandled server error")
    return jsonify({'error': 'Internal server error'}), 500



# ----------------------------------------------------------------------------
import io

def translate_text(text, target_lang='en'):
    """Translate text to target language with error handling using deep-translator."""
    if not text or target_lang == 'en':
        return text
    try:
        translated = GoogleTranslator(source='auto', target=target_lang).translate(text)
        return translated
    except Exception as e:
        logger.warning(f"Translation failed for lang={target_lang}: {e}")
        return text  # Return original if translation fails


def translate_dict_content(data, target_lang='en'):
    """Recursively translate dictionary content to target language."""
    if target_lang == 'en':
        return data
    
    translated = {}
    for key, value in data.items():
        if isinstance(value, str):
            translated[key] = translate_text(value, target_lang)
        elif isinstance(value, list):
            translated[key] = []
            for item in value:
                if isinstance(item, dict):
                    translated_item = {}
                    for k, v in item.items():
                        if isinstance(v, str):
                            translated_item[k] = translate_text(v, target_lang)
                        else:
                            translated_item[k] = v
                    translated[key].append(translated_item)
                elif isinstance(item, str):
                    translated[key].append(translate_text(item, target_lang))
                else:
                    translated[key].append(item)
        elif isinstance(value, dict):
            translated[key] = translate_dict_content(value, target_lang)
        else:
            translated[key] = value
    return translated


@app.post('/api/translate')
def translate_report():
    """Translate report content to specified language."""
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415

    data = request.get_json(silent=True) or {}
    content = data.get('content', {})
    target_lang = data.get('language', 'en')  # Default to English
    
    # Supported languages mapping
    LANG_CODES = {
        'english': 'en',
        'gujarati': 'gu',
        'hindi': 'hi',
        'spanish': 'es',
        'french': 'fr',
        'german': 'de',
        'chinese': 'zh-cn',
        'japanese': 'ja'
    }
    
    # Normalize language input
    lang_code = LANG_CODES.get(target_lang.lower(), target_lang.lower())
    
    try:
        translated_content = translate_dict_content(content, lang_code)
        return jsonify({
            'translated': translated_content,
            'language': lang_code,
            'status': 'success'
        })
    except Exception as e:
        logger.exception(f"Translation failed: {e}")
        return jsonify({'error': 'Translation failed', 'details': str(e)}), 500


@app.post('/api/report')
def generate_report():
    """Generate comprehensive multilingual plant health report with cognitive analysis."""
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415

    data = request.get_json(silent=True) or {}
    
    # Validate required fields
    if not data:
        logger.error("No JSON data received")
        return jsonify({'error': 'No data provided'}), 400
    
    language = data.get('language', 'english')  # Support language selection
    
    # Log received data
    logger.info(f"Report request received with language: {language}")
    logger.info(f"Data keys: {list(data.keys())}")
    
    # Normalize language code
    LANG_CODES = {'english': 'en', 'gujarati': 'gu', 'hindi': 'hi', 'spanish': 'es', 'french': 'fr', 'german': 'de'}
    lang_code = LANG_CODES.get(language.lower(), 'en')
    
    logger.info(f"Generating report in language: {language} (code: {lang_code})")
    
    # Extract data
    disease = data.get('disease', 'Unknown')
    description = data.get('description', '')
    remedies = data.get('remedies', [])
    confidence = data.get('confidence', 0)
    severity = data.get('severity', 'unknown')
    plant_name = data.get('plant_name', 'Unknown Plant')
    seasonal_tips = data.get('seasonal_tips', '')
    prescribed_care = data.get('prescribed_care', {})
    image_data = data.get('image')

    # Normalize remedies so downstream logic can safely assume dict-like items.
    normalized_remedies = []
    if isinstance(remedies, list):
        for idx, remedy in enumerate(remedies, 1):
            if isinstance(remedy, dict):
                normalized_remedies.append({
                    'step': remedy.get('step', idx),
                    'action': str(remedy.get('action', '')),
                    'timeframe': str(remedy.get('timeframe', ''))
                })
            elif isinstance(remedy, str):
                normalized_remedies.append({
                    'step': idx,
                    'action': remedy,
                    'timeframe': ''
                })
    remedies = normalized_remedies
    
    logger.info(f"Extracted data - Disease: {disease}, Plant: {plant_name}, Remedies: {len(remedies)}, Image: {'present' if image_data else 'none'}")
    
    # Translate content if language is not English
    if lang_code != 'en':
        try:
            logger.info(f"Translating content to {language}...")
            
            # Translate main fields
            if plant_name and plant_name != 'Unknown Plant':
                plant_name = translate_text(plant_name, lang_code) or plant_name
            if disease and disease != 'Unknown':
                disease = translate_text(disease, lang_code) or disease
            if description and len(description) > 10:
                description = translate_text(description, lang_code) or description
            if seasonal_tips and len(seasonal_tips) > 10:
                seasonal_tips = translate_text(seasonal_tips, lang_code) or seasonal_tips
            
            # Translate remedies
            if remedies:
                translated_remedies = []
                for r in remedies:
                    action = str(r.get('action', '')) if isinstance(r, dict) else str(r)
                    timeframe = str(r.get('timeframe', '')) if isinstance(r, dict) else ''
                    translated_remedies.append({
                        'step': r.get('step', '') if isinstance(r, dict) else '',
                        'action': translate_text(action, lang_code) if len(action) > 5 else action,
                        'timeframe': translate_text(timeframe, lang_code) if len(timeframe) > 3 else timeframe
                    })
                remedies = translated_remedies
            
            # Translate prescribed care
            if prescribed_care:
                try:
                    prescribed_care = translate_dict_content(prescribed_care, lang_code)
                except Exception as e:
                    logger.warning(f"Prescribed care translation failed: {e}")
                    
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            # Continue with English if translation fails

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage
        from reportlab.lib import colors

        # Prepare Specimen Image if provided
        plant_img_obj = None
        if image_data and isinstance(image_data, str) and len(image_data) > 30:
            try:
                _, raw_img_bytes, decode_err, _ = validate_and_decode_image(image_data)
                if raw_img_bytes and not decode_err:
                    from PIL import Image as PILImage
                    pil_img = PILImage.open(io.BytesIO(raw_img_bytes))
                    if pil_img.mode in ('RGBA', 'P', 'LA'):
                        pil_img = pil_img.convert('RGB')
                    
                    orig_w, orig_h = pil_img.size
                    max_w = 4.2 * inch
                    max_h = 2.6 * inch
                    scale = min(max_w / orig_w, max_h / orig_h)
                    disp_w = orig_w * scale
                    disp_h = orig_h * scale
                    
                    buf = io.BytesIO()
                    pil_img.save(buf, format='JPEG', quality=85)
                    buf.seek(0)
                    
                    plant_img_obj = RLImage(buf, width=disp_w, height=disp_h)
                    plant_img_obj.hAlign = 'CENTER'
                    logger.info(f"Specimen image processed for PDF | size={disp_w:.1f}x{disp_h:.1f}")
            except Exception as ie:
                logger.warning(f"Failed to process specimen image for report: {ie}")
        
        # Create PDF with ReportLab (supports Unicode)
        pdf_output = io.BytesIO()
        doc = SimpleDocTemplate(pdf_output, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1a5f7a'),
            spaceAfter=30,
            alignment=1  # Center
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#2d6a4f'),
            spaceAfter=12,
            spaceBefore=12
        )
        
        # Title
        title = Paragraph(f"🌿 Plant Health Analysis Report", title_style)
        story.append(title)
        story.append(Spacer(1, 0.2*inch))
        
        # Metadata
        report_date = datetime.now().strftime('%B %d, %Y at %H:%M')
        metadata_text = f"<i>Generated: {report_date}<br/>Report ID: PLT-{int(time.time())}<br/>Language: {language.title()}</i>"
        story.append(Paragraph(metadata_text, styles['Normal']))
        story.append(Spacer(1, 0.3*inch))
        
        # Plant Identity
        story.append(Paragraph("Identified Specimen", heading_style))
        story.append(Paragraph(f"<b>{plant_name}</b>", styles['Normal']))
        story.append(Spacer(1, 0.1*inch))
        
        if plant_img_obj:
            story.append(plant_img_obj)
            story.append(Spacer(1, 0.15*inch))
        
        # Diagnostic Summary
        story.append(Paragraph("Diagnostic Summary", heading_style))
        story.append(Paragraph(f"<b>Detected Condition:</b> {disease}", styles['Normal']))
        story.append(Paragraph(f"<b>Severity Level:</b> {severity.upper()}", styles['Normal']))
        story.append(Paragraph(f"<b>Diagnostic Confidence:</b> {confidence}%", styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Clinical Observations
        story.append(Paragraph("Clinical Observations & Analysis", heading_style))
        story.append(Paragraph(description or "No detailed analysis available.", styles['Normal']))
        story.append(Spacer(1, 0.2*inch))
        
        # Treatment Plan
        if remedies:
            story.append(Paragraph("Evidence-Based Treatment Protocol", heading_style))
            for i, remedy in enumerate(remedies, 1):
                if isinstance(remedy, dict):
                    action = remedy.get('action', '')
                    timeframe = remedy.get('timeframe', '')
                else:
                    action = str(remedy)
                    timeframe = ''
                if timeframe:
                    remedy_text = f"<b>Step {i}:</b> {action}<br/><i>Timeline: {timeframe}</i>"
                else:
                    remedy_text = f"<b>Step {i}:</b> {action}"
                story.append(Paragraph(remedy_text, styles['Normal']))
                story.append(Spacer(1, 0.1*inch))
        
        # Comprehensive Care Protocol
        if prescribed_care:
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph("Comprehensive Care Protocol", heading_style))
            
            if prescribed_care.get('overview'):
                story.append(Paragraph("<b>Overview</b>", styles['Heading3']))
                story.append(Paragraph(prescribed_care['overview'], styles['Normal']))
                story.append(Spacer(1, 0.1*inch))
            
            if prescribed_care.get('immediate_actions'):
                story.append(Paragraph("<b>Immediate Actions Required</b>", styles['Heading3']))
                actions = prescribed_care['immediate_actions']
                if isinstance(actions, list):
                    for action in actions[:7]:
                        story.append(Paragraph(f"• {action}", styles['Normal']))
                story.append(Spacer(1, 0.1*inch))
        
        # Seasonal Care
        if seasonal_tips:
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph("Seasonal Care Recommendations", heading_style))
            story.append(Paragraph(f"<i>{seasonal_tips}</i>", styles['Normal']))
        
        # Adaptive Weather & Soil Watering Schedule
        try:
            weather_data = fetch_weather_info()
            soil_data = fetch_soil_info()
            watering_sched = calculate_watering_schedule_backend(
                weather_data, soil_data, plant_name, disease, severity
            )
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph("Adaptive Watering Schedule (Weather & Soil Synced)", heading_style))
            
            today_info = watering_sched.get('today', {})
            story.append(Paragraph(f"<b>Today's Directive:</b> {today_info.get('action')}", styles['Heading3']))
            story.append(Paragraph(f"<i>Optimal Window:</i> {today_info.get('best_time')} | <i>Target Volume:</i> {today_info.get('volume')}", styles['Normal']))
            story.append(Paragraph(f"<i>Application Method:</i> {today_info.get('technique')}", styles['Normal']))
            story.append(Paragraph(f"<i>Environmental Rationale:</i> {today_info.get('rationale')}", styles['Normal']))
            
            if watering_sched.get('disease_rules'):
                story.append(Spacer(1, 0.05*inch))
                story.append(Paragraph("<b>Pathology Precaution:</b>", styles['Normal']))
                for rule in watering_sched.get('disease_rules', [])[:2]:
                    story.append(Paragraph(f"• {rule}", styles['Normal']))
        except Exception as we:
            logger.warning(f"Could not append watering schedule to PDF: {we}")
        
        # Footer
        story.append(Spacer(1, 0.3*inch))
        footer_text = "<i>This report is generated using AI-powered plant disease detection. For severe cases, consult a professional botanist or agricultural specialist.</i>"
        story.append(Paragraph(footer_text, styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        pdf_output.seek(0)
        filename = f"plant_health_report_{lang_code}_{int(time.time())}.pdf"
        logger.info(f"✅ PDF generated successfully: {filename}, size: {pdf_output.getbuffer().nbytes} bytes")
        
        # Return PDF file
        return send_file(
            pdf_output,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.exception(f"❌ PDF generation failed: {e}")
        return jsonify({
            'error': 'Failed to generate PDF report',
            'details': str(e)
        }), 500


# ----------------------------------------------------------------------------
# Authentication & User Data State Endpoints
# ----------------------------------------------------------------------------
@app.route('/api/auth/register', methods=['POST'])
def handle_register():
    if not request.is_json:
        return jsonify({'error': 'JSON payload required'}), 415
    data = request.get_json(silent=True) or {}
    email = data.get('email', '')
    username = data.get('username', '')
    password = data.get('password', '')
    
    try:
        user = database.register_user(email, username, password)
        token = auth.generate_auth_token(user['id'], user['email'], user['username'])
        logger.info(f"Registered user: {user['username']} ({user['email']})")
        return jsonify({
            'message': 'Registration successful',
            'user': user,
            'token': token
        }), 201
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logger.exception(f"Registration error: {e}")
        return jsonify({'error': 'Failed to complete registration'}), 500


@app.route('/api/auth/login', methods=['POST'])
def handle_login():
    if not request.is_json:
        return jsonify({'error': 'JSON payload required'}), 415
    data = request.get_json(silent=True) or {}
    login_id = data.get('email') or data.get('username') or data.get('login') or ''
    password = data.get('password', '')
    
    if not login_id or not password:
        return jsonify({'error': 'Username/Email and password are required'}), 400
        
    user = database.authenticate_user(login_id, password)
    if not user:
        return jsonify({'error': 'Invalid email/username or password'}), 401
        
    token = auth.generate_auth_token(user['id'], user['email'], user['username'])
    logger.info(f"User logged in: {user['username']}")
    return jsonify({
        'message': 'Login successful',
        'user': user,
        'token': token
    }), 200


@app.route('/api/auth/me', methods=['GET'])
@token_required
def handle_get_me(current_user):
    return jsonify({'user': current_user}), 200


@app.route('/api/user/data', methods=['GET'])
@token_required
def handle_get_user_data(current_user):
    user_id = current_user['id']
    plants = database.get_user_plants(user_id)
    scans = database.get_user_scans(user_id)
    return jsonify({
        'plants': plants,
        'scan_history': scans
    }), 200


@app.route('/api/user/sync', methods=['POST'])
@token_required
def handle_sync_user_data(current_user):
    user_id = current_user['id']
    data = request.get_json(silent=True) or {}
    plants = data.get('plants', [])
    scans = data.get('scan_history') or data.get('scans') or []
    
    stats = database.sync_user_data(user_id, plants, scans)
    return jsonify({
        'message': 'Data synced successfully',
        'stats': stats
    }), 200


@app.route('/api/user/plants', methods=['GET', 'POST'])
@token_required
def handle_user_plants(current_user):
    user_id = current_user['id']
    if request.method == 'GET':
        plants = database.get_user_plants(user_id)
        return jsonify({'plants': plants}), 200
        
    plant_data = request.get_json(silent=True) or {}
    saved = database.save_user_plant(user_id, plant_data)
    return jsonify({'plant': saved}), 200


@app.route('/api/user/plants/<plant_id>', methods=['DELETE'])
@token_required
def handle_delete_user_plant(current_user, plant_id):
    user_id = current_user['id']
    success = database.delete_user_plant(user_id, plant_id)
    if success:
        return jsonify({'message': 'Plant deleted'}), 200
    return jsonify({'error': 'Plant not found'}), 404


@app.route('/api/user/scans', methods=['GET', 'POST'])
@token_required
def handle_user_scans(current_user):
    user_id = current_user['id']
    if request.method == 'GET':
        scans = database.get_user_scans(user_id)
        return jsonify({'scans': scans}), 200
        
    scan_data = request.get_json(silent=True) or {}
    saved = database.save_user_scan(user_id, scan_data)
    return jsonify({'scan': saved}), 200


# ----------------------------------------------------------------------------
# Entrypoint
# ----------------------------------------------------------------------------
if __name__ == '__main__':
    logger.info("="*70)
    logger.info("🌿 Plant Disease Detection API Starting...")
    logger.info("="*70)
    logger.info(f"📡 Server: http://{HOST}:{PORT}")
    logger.info(f"🔧 Debug Mode: {DEBUG}")
    logger.info(f"🤖 AI Provider Order: {' → '.join(PROVIDER_ORDER)}")
    logger.info(f"🧠 Gemini API: {'✅ Configured (' + GEMINI_MODEL + ')' if GEMINI_API_KEY else '❌ Not configured'}")
    logger.info(f"🤗 Hugging Face API: {'✅ Configured' if HUGGINGFACE_API_KEY else '❌ Not configured'}")
    logger.info(f"🌦️  Weather API: {'✅ Configured' if OPENWEATHER_API_KEY else '❌ Not configured'}")
    logger.info(f"🌱 Soil API: {'✅ Configured' if SOIL_API_KEY else '❌ Not configured'}")
    logger.info("="*70)
    logger.info("📍 Endpoints Available:")
    logger.info("   POST /api/analyze        - Plant disease analysis")
    logger.info("   GET  /api/health         - Health check")
    logger.info("   GET  /api/diseases       - List diseases")
    logger.info("   POST /api/report         - Download PDF report")
    logger.info("   GET  /api/environment/weather - Weather data")
    logger.info("   GET  /api/environment/soil    - Soil data")
    logger.info("="*70)
    logger.info("🚀 Ready to analyze plants! Waiting for requests...")
    logger.info("="*70)
    app.run(host=HOST, port=PORT, debug=DEBUG)
