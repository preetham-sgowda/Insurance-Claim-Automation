#!/usr/bin/env bash
set -euo pipefail

echo "[Render] Starting NexSettle boot sequence..."

if [[ "${RUN_BOOTSTRAP_ON_START:-true}" == "true" ]]; then
  python manage.py setup_mongodb
  python manage.py backfill_user_ids
fi

if [[ "${SEED_ADMIN_ON_START:-false}" == "true" ]]; then
  python scripts/seed_admin.py
fi

if [[ "${SEED_POLICY_DATA_ON_START:-false}" == "true" ]]; then
  python manage.py seed_policy_holders
fi

echo "[Render] Launching Gunicorn..."
exec gunicorn nexsettle.wsgi:application \
  --bind 0.0.0.0:${PORT:-8000} \
  --workers ${GUNICORN_WORKERS:-2} \
  --timeout ${GUNICORN_TIMEOUT:-120}

