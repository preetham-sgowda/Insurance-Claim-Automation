"""
NexSettle — seed_admin management command
Usage: python manage.py seed_admin
"""

from django.core.management.base import BaseCommand
import bcrypt
from db.mongo_client import get_collection, Collections
from utils.id_generators import now_utc


class Command(BaseCommand):
    help = "Seed the default admin account into MongoDB."

    def add_arguments(self, parser):
        parser.add_argument("--email",    default="admin@nexsettle.org",   help="Admin email")
        parser.add_argument("--password", default="Admin@123",              help="Admin password")
        parser.add_argument("--name",     default="NexSettle Admin",        help="Admin name")

    def handle(self, *args, **options):
        email    = options["email"]
        password = options["password"]
        name     = options["name"]

        admins_col = get_collection(Collections.ADMINS)

        if admins_col.find_one({"email": email}):
            self.stdout.write(self.style.WARNING(f"[SKIP] Admin '{email}' already exists."))
            return

        count  = admins_col.count_documents({})
        admin_id = f"ADM_{count + 1:03d}"
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        admins_col.insert_one({
            "admin_id":   admin_id,
            "name":       name,
            "email":      email,
            "password":   hashed,
            "created_at": now_utc(),
        })

        self.stdout.write(self.style.SUCCESS(f"[OK] Admin created:"))
        self.stdout.write(f"     Admin ID: {admin_id}")
        self.stdout.write(f"     Email:    {email}")
        self.stdout.write(f"     Password: {password}")
