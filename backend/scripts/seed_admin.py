"""
NexSettle — Seed Admin Script
Run: python scripts/seed_admin.py
Creates a default admin account in MongoDB.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nexsettle.settings")

import django
django.setup()

import bcrypt
from db.mongo_client import get_collection, Collections
from utils.id_generators import now_utc


def seed_admin():
    admins_col = get_collection(Collections.ADMINS)

    email = "admin@nexsettle.org"
    if admins_col.find_one({"email": email}):
        print(f"[SKIP] Admin '{email}' already exists.")
        return

    password = "Admin@123"
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    admins_col.insert_one({
        "admin_id": "ADM_001",
        "name": "NexSettle Admin",
        "email": email,
        "password": hashed,
        "created_at": now_utc(),
    })

    print(f"[OK] Admin created:")
    print(f"     Email:    {email}")
    print(f"     Password: {password}")
    print(f"     Admin ID: ADM_001")


if __name__ == "__main__":
    seed_admin()
