"""
NexSettle Django Settings
"""

import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

SECRET_KEY = config("SECRET_KEY", default="nexsettle-super-secret-key-change-in-production")

_debug_raw = str(config("DEBUG", default="True")).strip().lower()
DEBUG = _debug_raw in {"1", "true", "yes", "on", "debug", "dev", "development"}

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    # NexSettle Apps
    "apps.authentication",
    "apps.claims",
    "apps.documents",
    "apps.ai_pipeline",
    "apps.fraud_detection",
    "apps.reports",
    "apps.agents",
    "apps.admins",
    # Management commands
    "management",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "nexsettle.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "nexsettle.wsgi.application"

# No SQL Database — all data goes to MongoDB
DATABASES = {}

# MongoDB Configuration
MONGO_URI = config("MONGO_URI", default="mongodb://localhost:27017/")
MONGO_DB_NAME = config("MONGO_DB_NAME", default="nexsettle_db")

# Static / Media
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# CSRF trusted origins (needed for browsers hitting the API)
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:8000,http://127.0.0.1:8000",
).split(",")

# Disable CSRF for REST API views (JWT-based auth handles security)
CSRF_COOKIE_SECURE = False

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
}

# JWT Settings
JWT_SECRET = config("JWT_SECRET", default="nexsettle-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# Google Gemini
GEMINI_API_KEY = config("GEMINI_API_KEY", default="")
_use_gemini_raw = str(config("USE_GEMINI", default="True")).strip().lower()
USE_GEMINI = _use_gemini_raw in {"1", "true", "yes", "on"}
_use_crew_raw = str(config("USE_CREW_AI", default="False")).strip().lower()
USE_CREW_AI = _use_crew_raw in {"1", "true", "yes", "on"}
AI_ORCHESTRATOR = str(config("AI_ORCHESTRATOR", default="langgraph")).strip().lower()

# Tesseract OCR — Windows path (update if installed elsewhere)
TESSERACT_CMD = config(
    "TESSERACT_CMD",
    default=r"C:\Program Files\Tesseract-OCR\tesseract.exe",
)

# Email (OTP)
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")

# Developer fallback: if SMTP credentials are placeholders in DEBUG mode,
# route OTP emails to console so local signup can proceed.
if DEBUG and (
    not EMAIL_HOST_USER
    or EMAIL_HOST_USER.strip().lower() == "your-email@gmail.com"
    or not EMAIL_HOST_PASSWORD
    or EMAIL_HOST_PASSWORD.strip().lower() == "your-app-password-here"
):
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# File Upload
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "text/plain"]

# OTP
OTP_EXPIRY_MINUTES = 10

# Logging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "nexsettle": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
