"""
Database module for AgroSense.
Implements SQLite storage for Users, Plants, and Scan History with foreign key constraints.
"""

import os
import json
import sqlite3
import datetime
from typing import Optional, List, Dict, Any
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agrosense.db')


def get_db_connection() -> sqlite3.Connection:
    """Create and return a database connection with dict row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize database tables and indexes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 2. Plants table (tracked plants per user)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plants (
                id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                species_id TEXT,
                species_name TEXT,
                location TEXT DEFAULT 'outdoor',
                planting_date TEXT,
                last_watered TEXT,
                last_inspected TEXT,
                last_pruned TEXT,
                last_fertilized TEXT,
                health_status TEXT DEFAULT 'healthy',
                health_stage TEXT DEFAULT 'recovered',
                health_vigor INTEGER DEFAULT 5,
                active_disease TEXT,
                notes TEXT,
                data_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # 3. Scans table (scan diagnosis history per user)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                plant_id TEXT,
                plant_name TEXT,
                disease TEXT,
                severity TEXT,
                confidence INTEGER,
                description TEXT,
                image TEXT,
                data_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_plants_user ON plants(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
        
        conn.commit()


# ── User Operations ─────────────────────────────────────────────────────────

def register_user(email: str, username: str, password: str) -> Dict[str, Any]:
    """Register a new user and return user record."""
    clean_email = email.strip().lower()
    clean_username = username.strip()
    
    if not clean_email or '@' not in clean_email:
        raise ValueError("Valid email address is required")
    if not clean_username or len(clean_username) < 2:
        raise ValueError("Username must be at least 2 characters")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters")
        
    pwd_hash = generate_password_hash(password)
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (clean_email,))
        if cursor.fetchone():
            raise ValueError("An account with this email already exists")
            
        cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (clean_username.lower(),))
        if cursor.fetchone():
            raise ValueError("Username is already taken")
            
        cursor.execute(
            "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
            (clean_email, clean_username, pwd_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        
        return {
            "id": user_id,
            "email": clean_email,
            "username": clean_username,
            "created_at": datetime.datetime.utcnow().isoformat()
        }


def authenticate_user(login_id: str, password: str) -> Optional[Dict[str, Any]]:
    """Verify credentials and return user record if valid."""
    clean_login = login_id.strip()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, username, password_hash, created_at FROM users WHERE email = ? OR LOWER(username) = ?",
            (clean_login.lower(), clean_login.lower())
        )
        row = cursor.fetchone()
        if not row:
            return None
            
        if check_password_hash(row["password_hash"], password):
            return {
                "id": row["id"],
                "email": row["email"],
                "username": row["username"],
                "created_at": row["created_at"]
            }
        return None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve user by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, username, created_at FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)


# ── Plant Operations ────────────────────────────────────────────────────────

def get_user_plants(user_id: int) -> List[Dict[str, Any]]:
    """Retrieve all plants for a specific user."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM plants WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        result = []
        for r in rows:
            plant_dict = dict(r)
            # Unpack JSON data if present
            extra_data = {}
            if plant_dict.get('data_json'):
                try:
                    extra_data = json.loads(plant_dict['data_json'])
                except Exception:
                    pass
            plant_dict.pop('data_json', None)
            
            # Map snake_case to camelCase expected by frontend
            normalized = {
                'id': plant_dict['id'],
                'name': plant_dict['name'],
                'speciesId': plant_dict['species_id'],
                'speciesName': plant_dict['species_name'],
                'location': plant_dict['location'],
                'plantingDate': plant_dict['planting_date'] or '',
                'lastWatered': plant_dict['last_watered'] or '',
                'lastInspected': plant_dict['last_inspected'] or '',
                'lastPruned': plant_dict['last_pruned'] or '',
                'lastFertilized': plant_dict['last_fertilized'] or '',
                'healthStatus': plant_dict['health_status'] or 'healthy',
                'healthStage': plant_dict['health_stage'] or 'recovered',
                'healthVigor': plant_dict['health_vigor'] or 5,
                'activeDisease': plant_dict['active_disease'] or '',
                'notes': plant_dict['notes'] or '',
                **extra_data
            }
            result.append(normalized)
        return result


def save_user_plant(user_id: int, plant_data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert or update a plant for the user."""
    plant_id = str(plant_data.get('id') or f"plant_{int(datetime.datetime.utcnow().timestamp()*1000)}")
    name = plant_data.get('name') or 'Unnamed Plant'
    species_id = plant_data.get('speciesId') or plant_data.get('species_id') or 'custom'
    species_name = plant_data.get('speciesName') or plant_data.get('species_name') or species_id
    location = plant_data.get('location') or 'outdoor'
    planting_date = plant_data.get('plantingDate') or plant_data.get('planting_date') or ''
    last_watered = plant_data.get('lastWatered') or plant_data.get('last_watered') or ''
    last_inspected = plant_data.get('lastInspected') or plant_data.get('last_inspected') or ''
    last_pruned = plant_data.get('lastPruned') or plant_data.get('last_pruned') or ''
    last_fertilized = plant_data.get('lastFertilized') or plant_data.get('last_fertilized') or ''
    health_status = plant_data.get('healthStatus') or plant_data.get('health_status') or 'healthy'
    health_stage = plant_data.get('healthStage') or plant_data.get('health_stage') or 'recovered'
    health_vigor = int(plant_data.get('healthVigor') or plant_data.get('health_vigor') or 5)
    active_disease = plant_data.get('activeDisease') or plant_data.get('active_disease') or ''
    notes = plant_data.get('notes') or ''

    # Store any extra keys (remedies, treatmentSchedule, healthLogs, customRemedies, etc.)
    extra = {}
    for k, v in plant_data.items():
        if k not in ['id', 'name', 'speciesId', 'species_id', 'speciesName', 'species_name', 
                     'location', 'plantingDate', 'planting_date', 'lastWatered', 'last_watered',
                     'lastInspected', 'last_inspected', 'lastPruned', 'last_pruned',
                     'lastFertilized', 'last_fertilized', 'healthStatus', 'health_status',
                     'healthStage', 'health_stage', 'healthVigor', 'health_vigor',
                     'activeDisease', 'active_disease', 'notes', 'user_id']:
            extra[k] = v

    data_json = json.dumps(extra)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO plants (
                id, user_id, name, species_id, species_name, location,
                planting_date, last_watered, last_inspected, last_pruned, last_fertilized,
                health_status, health_stage, health_vigor, active_disease, notes, data_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id, user_id) DO UPDATE SET
                name=excluded.name,
                species_id=excluded.species_id,
                species_name=excluded.species_name,
                location=excluded.location,
                planting_date=excluded.planting_date,
                last_watered=excluded.last_watered,
                last_inspected=excluded.last_inspected,
                last_pruned=excluded.last_pruned,
                last_fertilized=excluded.last_fertilized,
                health_status=excluded.health_status,
                health_stage=excluded.health_stage,
                health_vigor=excluded.health_vigor,
                active_disease=excluded.active_disease,
                notes=excluded.notes,
                data_json=excluded.data_json,
                updated_at=CURRENT_TIMESTAMP
        """, (
            plant_id, user_id, name, species_id, species_name, location,
            planting_date, last_watered, last_inspected, last_pruned, last_fertilized,
            health_status, health_stage, health_vigor, active_disease, notes, data_json
        ))
        conn.commit()

    plant_data['id'] = plant_id
    return plant_data


def delete_user_plant(user_id: int, plant_id: str) -> bool:
    """Delete a plant belonging to the user."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM plants WHERE id = ? AND user_id = ?", (plant_id, user_id))
        conn.commit()
        return cursor.rowcount > 0


# ── Scan Operations ─────────────────────────────────────────────────────────

def get_user_scans(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve scan history for a user."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        )
        rows = cursor.fetchall()
        result = []
        for r in rows:
            scan = dict(r)
            extra = {}
            if scan.get('data_json'):
                try:
                    extra = json.loads(scan['data_json'])
                except Exception:
                    pass
            scan.pop('data_json', None)
            normalized = {
                'id': scan['id'],
                'plantId': scan['plant_id'],
                'plant_name': scan['plant_name'],
                'disease': scan['disease'],
                'severity': scan['severity'],
                'confidence': scan['confidence'],
                'description': scan['description'],
                'image': scan['image'],
                'timestamp': scan['created_at'],
                **extra
            }
            result.append(normalized)
        return result


def save_user_scan(user_id: int, scan_data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert or update a scan result for the user."""
    scan_id = str(scan_data.get('id') or f"scan_{int(datetime.datetime.utcnow().timestamp()*1000)}")
    plant_id = scan_data.get('plantId') or scan_data.get('plant_id') or None
    plant_name = scan_data.get('plant_name') or scan_data.get('plantName') or 'Unknown'
    disease = scan_data.get('disease') or 'Healthy'
    severity = scan_data.get('severity') or 'low'
    confidence = int(scan_data.get('confidence') or 0)
    description = scan_data.get('description') or ''
    image = scan_data.get('image') or ''

    extra = {}
    for k, v in scan_data.items():
        if k not in ['id', 'plantId', 'plant_id', 'plant_name', 'plantName', 'disease', 
                     'severity', 'confidence', 'description', 'image', 'user_id', 'timestamp']:
            extra[k] = v

    data_json = json.dumps(extra)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO scans (
                id, user_id, plant_id, plant_name, disease, severity,
                confidence, description, image, data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id, user_id) DO UPDATE SET
                plant_id=excluded.plant_id,
                plant_name=excluded.plant_name,
                disease=excluded.disease,
                severity=excluded.severity,
                confidence=excluded.confidence,
                description=excluded.description,
                image=excluded.image,
                data_json=excluded.data_json
        """, (
            scan_id, user_id, plant_id, plant_name, disease, severity,
            confidence, description, image, data_json
        ))
        conn.commit()

    scan_data['id'] = scan_id
    return scan_data


def sync_user_data(user_id: int, plants: List[Dict[str, Any]], scans: List[Dict[str, Any]]) -> Dict[str, int]:
    """Bulk synchronize user plants and scan history."""
    plant_count = 0
    scan_count = 0
    if plants and isinstance(plants, list):
        for p in plants:
            if isinstance(p, dict):
                save_user_plant(user_id, p)
                plant_count += 1
                
    if scans and isinstance(scans, list):
        for s in scans:
            if isinstance(s, dict):
                save_user_scan(user_id, s)
                scan_count += 1
                
    return {"plants_synced": plant_count, "scans_synced": scan_count}
