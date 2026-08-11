"""
NexSettle - setup_mongodb management command
Usage: python manage.py setup_mongodb

Creates nexsettle_db collections and indexes required by the platform.
"""

from django.conf import settings
from django.core.management.base import BaseCommand
from pymongo import ASCENDING, DESCENDING

from db.mongo_client import Collections, get_db


REQUIRED_COLLECTIONS = [
    Collections.USERS,
    Collections.OTP_VERIFICATION,
    Collections.POLICY_HOLDER_DATA,
    Collections.NOMINEE_DETAILS,
    Collections.CLAIMS,
    Collections.CLAIM_DOCUMENTS,
    Collections.AGENTS,
    Collections.ADMINS,
    Collections.FRAUD_LOGS,
]


class Command(BaseCommand):
    help = "Create nexsettle_db and required collections/indexes in MongoDB."

    def handle(self, *args, **options):
        db = get_db()
        self.stdout.write(self.style.SUCCESS(f"[INFO] Connected DB: {settings.MONGO_DB_NAME}"))

        existing = set(db.list_collection_names())

        created = 0
        for name in REQUIRED_COLLECTIONS:
            if name not in existing:
                db.create_collection(name)
                self.stdout.write(self.style.SUCCESS(f"[OK] Created collection: {name}"))
                created += 1
            else:
                self.stdout.write(self.style.WARNING(f"[SKIP] Collection exists: {name}"))

        self._create_indexes(db)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Database '{settings.MONGO_DB_NAME}' is ready. "
                f"Collections created: {created}, total required: {len(REQUIRED_COLLECTIONS)}."
            )
        )

    def _create_indexes(self, db):
        users = db[Collections.USERS]
        users.create_index(
            [("user_id", ASCENDING)],
            unique=True,
            name="uniq_user_id",
            partialFilterExpression={"user_id": {"$exists": True, "$type": "string"}},
        )
        users.create_index(
            [("email", ASCENDING)],
            unique=True,
            name="uniq_user_email",
            partialFilterExpression={"email": {"$exists": True, "$type": "string"}},
        )
        users.create_index(
            [("username", ASCENDING)],
            unique=True,
            name="uniq_username",
            partialFilterExpression={"username": {"$exists": True, "$type": "string"}},
        )

        otp = db[Collections.OTP_VERIFICATION]
        otp.create_index([("user_id", ASCENDING)], name="idx_otp_user_id")
        otp.create_index([("created_at", DESCENDING)], name="idx_otp_created_at")
        otp.create_index(
            [("expires_at", ASCENDING)],
            expireAfterSeconds=0,
            name="ttl_otp_expires_at",
        )

        policy = db[Collections.POLICY_HOLDER_DATA]
        policy.create_index(
            [("user_unique_id", ASCENDING)],
            unique=True,
            name="uniq_policy_user",
            partialFilterExpression={"user_unique_id": {"$exists": True, "$type": "string"}},
        )
        policy.create_index(
            [("policy_number", ASCENDING)],
            unique=True,
            name="uniq_policy_number",
            partialFilterExpression={"policy_number": {"$exists": True, "$type": "string"}},
        )

        nominee = db[Collections.NOMINEE_DETAILS]
        nominee.create_index(
            [("user_unique_id", ASCENDING), ("policy_number", ASCENDING)],
            unique=True,
            name="uniq_nominee_user_policy",
        )

        claims = db[Collections.CLAIMS]
        claims.create_index(
            [("claim_id", ASCENDING)],
            unique=True,
            name="uniq_claim_id",
            partialFilterExpression={"claim_id": {"$exists": True, "$type": "string"}},
        )
        claims.create_index([("user_unique_id", ASCENDING)], name="idx_claim_user")
        claims.create_index([("claim_status", ASCENDING)], name="idx_claim_status")
        claims.create_index([("created_at", DESCENDING)], name="idx_claim_created_at")

        claim_docs = db[Collections.CLAIM_DOCUMENTS]
        claim_docs.create_index(
            [("claim_id", ASCENDING)],
            unique=True,
            name="uniq_claim_docs_claim_id",
            partialFilterExpression={"claim_id": {"$exists": True, "$type": "string"}},
        )

        agents = db[Collections.AGENTS]
        agents.create_index(
            [("agent_id", ASCENDING)],
            unique=True,
            name="uniq_agent_id",
            partialFilterExpression={"agent_id": {"$exists": True, "$type": "string"}},
        )
        agents.create_index(
            [("agent_email", ASCENDING)],
            unique=True,
            name="uniq_agent_email",
            partialFilterExpression={"agent_email": {"$exists": True, "$type": "string"}},
        )

        admins = db[Collections.ADMINS]
        admins.create_index(
            [("admin_id", ASCENDING)],
            unique=True,
            name="uniq_admin_id",
            partialFilterExpression={"admin_id": {"$exists": True, "$type": "string"}},
        )
        admins.create_index(
            [("email", ASCENDING)],
            unique=True,
            name="uniq_admin_email",
            partialFilterExpression={"email": {"$exists": True, "$type": "string"}},
        )

        fraud_logs = db[Collections.FRAUD_LOGS]
        fraud_logs.create_index([("claim_id", ASCENDING)], name="idx_fraud_claim_id")
        fraud_logs.create_index([("created_at", DESCENDING)], name="idx_fraud_created_at")

        self.stdout.write(self.style.SUCCESS("[OK] Indexes verified/created."))
