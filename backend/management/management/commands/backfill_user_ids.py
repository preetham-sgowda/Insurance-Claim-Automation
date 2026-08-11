"""
NexSettle - backfill_user_ids management command
Usage: python manage.py backfill_user_ids

Assigns missing user_id values in users collection using USR_0001 format.
"""

from django.core.management.base import BaseCommand

from db.mongo_client import Collections, get_collection
from utils.id_generators import generate_user_id, now_utc


class Command(BaseCommand):
    help = "Backfill missing user_id in users collection."

    def handle(self, *args, **options):
        users_col = get_collection(Collections.USERS)
        users = list(users_col.find({}))
        if not users:
            self.stdout.write(self.style.WARNING("[WARN] No users found."))
            return

        existing_numbers = []
        for u in users:
            uid = u.get("user_id")
            if isinstance(uid, str) and uid.startswith("USR_"):
                try:
                    existing_numbers.append(int(uid.split("_")[1]))
                except Exception:
                    continue

        next_number = (max(existing_numbers) + 1) if existing_numbers else 1
        updated = 0

        for user in users:
            if user.get("user_id"):
                continue

            new_user_id = generate_user_id(next_number)
            next_number += 1

            users_col.update_one(
                {"_id": user["_id"]},
                {"$set": {"user_id": new_user_id, "updated_at": now_utc()}},
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"[OK] Assigned {new_user_id} to user email={user.get('email', 'unknown')}"
                )
            )
            updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. Backfilled user_id for {updated} user(s).")
        )

