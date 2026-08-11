"""
NexSettle - bootstrap_project management command
Usage: python manage.py bootstrap_project

Initializes MongoDB collections, repairs legacy user IDs, and seeds baseline data.
"""

from django.core.management import BaseCommand, call_command


class Command(BaseCommand):
    help = "Bootstrap NexSettle project from initial to ready-to-run state."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("[1/4] Setting up MongoDB collections and indexes..."))
        call_command("setup_mongodb")

        self.stdout.write(self.style.SUCCESS("[2/4] Backfilling missing user IDs (if any)..."))
        call_command("backfill_user_ids")

        self.stdout.write(self.style.SUCCESS("[3/4] Seeding admin..."))
        call_command("seed_admin")

        self.stdout.write(self.style.SUCCESS("[4/4] Seeding policy holder data..."))
        call_command("seed_policy_holders")

        self.stdout.write(self.style.SUCCESS("\nBootstrap complete. Project is ready to run."))

