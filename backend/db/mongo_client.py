"""
NexSettle — MongoDB Client
Single shared connection to nexsettle_db.
"""

import logging
from django.conf import settings
import pymongo

logger = logging.getLogger("nexsettle")

_client = None
_db = None


def get_db():
    """Return the shared MongoDB database instance."""
    global _client, _db
    if _db is None:
        try:
            _client = pymongo.MongoClient(
                settings.MONGO_URI,
                serverSelectionTimeoutMS=5000,
            )
            _db = _client[settings.MONGO_DB_NAME]
            # Ping to verify connection
            _client.admin.command("ping")
            logger.info(f"MongoDB connected → {settings.MONGO_DB_NAME}")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            raise
    return _db


class Collections:
    """Namespace for collection name constants."""
    USERS               = "users"
    OTP_VERIFICATION    = "otp_verification"
    POLICY_HOLDER_DATA  = "policy_holder_data"
    NOMINEE_DETAILS     = "nominee_details"
    CLAIMS              = "claims"
    CLAIM_DOCUMENTS     = "claim_documents"
    AGENTS              = "agents"
    ADMINS              = "admins"
    FRAUD_LOGS          = "fraud_logs"


def get_collection(name: str):
    """Return a MongoDB collection by name."""
    return get_db()[name]
