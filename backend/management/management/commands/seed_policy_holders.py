"""
NexSettle - seed_policy_holders management command
Usage: python manage.py seed_policy_holders

Seeds sample policy holder data for testing.
Creates one policy per registered user if no record exists.
"""

from django.core.management.base import BaseCommand

from db.mongo_client import Collections, get_collection
from utils.id_generators import now_utc


SAMPLE_POLICIES = [
    {
        "policy_number": "POL123456",
        "aadhaar_id": "********1234",
        "pan_id": "*****1234F",
        "sum_assured": 1000000,
        "medical_history": "None",
        "lifestyle_habits": "Non-smoker",
    },
    {
        "policy_number": "POL789012",
        "aadhaar_id": "********5678",
        "pan_id": "*****5678G",
        "sum_assured": 2000000,
        "medical_history": "Hypertension (controlled)",
        "lifestyle_habits": "Non-smoker",
    },
]


class Command(BaseCommand):
    help = "Seed sample policy holder data for all existing users."

    def _next_unique_policy_number(self, policy_col, base: str = "POL") -> str:
        """
        Generate a unique policy number like POL123456 based on existing records.
        """
        existing = policy_col.find({}, {"policy_number": 1, "_id": 0})
        max_num = 100000
        for rec in existing:
            val = rec.get("policy_number")
            if isinstance(val, str) and val.startswith(base):
                suffix = val[len(base):]
                if suffix.isdigit():
                    max_num = max(max_num, int(suffix))
        return f"{base}{max_num + 1}"

    def handle(self, *args, **options):
        users_col = get_collection(Collections.USERS)
        policy_col = get_collection(Collections.POLICY_HOLDER_DATA)

        users = list(users_col.find({}))
        if not users:
            self.stdout.write(
                self.style.WARNING("[WARN] No users found. Register at least one user first.")
            )
            return

        seeded = 0
        skipped_invalid = 0
        for i, user in enumerate(users):
            uid = user.get("user_id")
            if not uid:
                email = user.get("email", "unknown-email")
                self.stdout.write(
                    self.style.WARNING(f"[SKIP] User record missing user_id (email: {email}).")
                )
                skipped_invalid += 1
                continue

            if policy_col.find_one({"user_unique_id": uid}):
                self.stdout.write(self.style.WARNING(f"[SKIP] Policy data already exists for {uid}"))
                continue

            template = dict(SAMPLE_POLICIES[i % len(SAMPLE_POLICIES)])
            template_policy_number = template.get("policy_number")
            if template_policy_number and policy_col.find_one({"policy_number": template_policy_number}):
                template["policy_number"] = self._next_unique_policy_number(policy_col)

            record = {"user_unique_id": uid, "created_at": now_utc(), **template}
            policy_col.insert_one(record)
            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Policy holder data created for {uid} -> {template['policy_number']}"
                )
            )
            seeded += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. Seeded {seeded} policy holder record(s). "
                f"Skipped invalid user records: {skipped_invalid}."
            )
        )
