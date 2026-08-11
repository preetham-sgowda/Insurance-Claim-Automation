"""
WSGI config for NexSettle project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nexsettle.settings")
application = get_wsgi_application()
