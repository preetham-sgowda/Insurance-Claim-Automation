"""
NexSettle - smoke_test_flow management command
Usage: python manage.py smoke_test_flow

Runs an end-to-end API smoke test:
register -> verify otp -> login -> profile -> pipeline -> claims -> report download
"""

import random
import string

from django.core.management.base import BaseCommand
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from rest_framework.test import APIClient

from db.mongo_client import Collections, get_collection


class Command(BaseCommand):
    help = "Run end-to-end API smoke test for NexSettle."

    def handle(self, *args, **options):
        settings.USE_GEMINI = False
        client = APIClient()
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
        email = f"smoke_{suffix}@example.com"
        username = f"smoke_{suffix}"
        password = "Smoke@123"

        self.stdout.write(self.style.SUCCESS("[1/7] Registering user..."))
        register_res = client.post(
            "/api/auth/register/",
            {"username": username, "email": email, "password": password},
            format="json",
        )
        if register_res.status_code != 201:
            self.stdout.write(self.style.ERROR(f"Register failed: {register_res.status_code} {register_res.data}"))
            return

        user_id = register_res.data.get("user_id")
        if not user_id:
            self.stdout.write(self.style.ERROR("Register response missing user_id."))
            return

        otp_col = get_collection(Collections.OTP_VERIFICATION)
        otp_doc = otp_col.find_one({"user_id": user_id, "is_used": False})
        if not otp_doc:
            self.stdout.write(self.style.ERROR("Could not find OTP record for newly registered user."))
            return

        self.stdout.write(self.style.SUCCESS("[2/7] Verifying OTP..."))
        verify_res = client.post(
            "/api/auth/verify-otp/",
            {"user_id": user_id, "otp_code": otp_doc["otp_code"]},
            format="json",
        )
        if verify_res.status_code != 200:
            self.stdout.write(self.style.ERROR(f"OTP verify failed: {verify_res.status_code} {verify_res.data}"))
            return

        self.stdout.write(self.style.SUCCESS("[3/7] Logging in..."))
        login_res = client.post(
            "/api/auth/login/",
            {"email": email, "password": password},
            format="json",
        )
        if login_res.status_code != 200:
            self.stdout.write(self.style.ERROR(f"Login failed: {login_res.status_code} {login_res.data}"))
            return

        token = login_res.data.get("token")
        if not token:
            self.stdout.write(self.style.ERROR("Login response missing token."))
            return
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        self.stdout.write(self.style.SUCCESS("[4/7] Fetching profile..."))
        profile_res = client.get("/api/auth/profile/")
        if profile_res.status_code != 200:
            self.stdout.write(self.style.ERROR(f"Profile failed: {profile_res.status_code} {profile_res.data}"))
            return

        self.stdout.write(self.style.SUCCESS("[5/7] Running AI pipeline with TXT documents..."))
        aadhaar_txt = (
            "Aadhaar\nUIDAI\nGovernment of India\nAadhaar Number: 1234 5678 9012\n"
        ).encode("utf-8")
        pan_txt = (
            "Income Tax Department\nPermanent Account Number\nPAN: ABCDE1234F\n"
        ).encode("utf-8")

        file1 = SimpleUploadedFile("aadhaar.txt", aadhaar_txt, content_type="text/plain")
        file2 = SimpleUploadedFile("pan.txt", pan_txt, content_type="text/plain")
        pipeline_res = client.post(
            "/api/pipeline/process/",
            {"files": [file1, file2]},
            format="multipart",
        )
        if pipeline_res.status_code != 200:
            self.stdout.write(self.style.ERROR(f"Pipeline failed: {pipeline_res.status_code} {pipeline_res.data}"))
            return

        claim_id = pipeline_res.data.get("claim_id")
        if not claim_id:
            self.stdout.write(self.style.ERROR("Pipeline response missing claim_id."))
            return

        self.stdout.write(self.style.SUCCESS("[6/7] Listing claims..."))
        claims_res = client.get("/api/claims/list/")
        if claims_res.status_code != 200:
            self.stdout.write(self.style.ERROR(f"Claims list failed: {claims_res.status_code} {claims_res.data}"))
            return

        claim_ids = [c.get("claim_id") for c in claims_res.data.get("claims", [])]
        if claim_id not in claim_ids:
            self.stdout.write(self.style.ERROR("New claim not found in claims list."))
            return

        self.stdout.write(self.style.SUCCESS("[7/7] Downloading generated report..."))
        report_res = client.get(f"/api/reports/{claim_id}/download/")
        if report_res.status_code != 200:
            self.stdout.write(self.style.ERROR(f"Report download failed: {report_res.status_code}"))
            return
        if "application/pdf" not in report_res.get("Content-Type", ""):
            self.stdout.write(self.style.ERROR("Report endpoint did not return PDF content type."))
            return

        self.stdout.write(self.style.SUCCESS("\nSmoke test passed end-to-end."))
        self.stdout.write(self.style.SUCCESS(f"User: {email}"))
        self.stdout.write(self.style.SUCCESS(f"Claim: {claim_id}"))
