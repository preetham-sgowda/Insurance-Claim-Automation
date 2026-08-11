# Render Deployment Guide

This document contains the full deployment guide for hosting NexSettle on Render.

## Deployment Files

- `render.yaml` - Render Blueprint definition
- `backend/start_render.sh` - Startup script used by Render
- `backend/Procfile` - Process command definition
- `backend/runtime.txt` - Python runtime version
- `backend/.env.example` - Environment variable template

## Deploy Steps

1. Push this repository to GitHub.
2. In Render, create a new Blueprint service from this repository.
3. Render will detect `render.yaml` and provision the web service.
4. Set required environment variables in Render dashboard.
5. Trigger deployment.

## Required Environment Variables

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS` (your Render domain)
- `MONGO_URI` (MongoDB Atlas/remote URI)
- `MONGO_DB_NAME` (default: `nexsettle_db`)
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `USE_GEMINI=True`
- `USE_CREW_AI=True`
- `AI_ORCHESTRATOR=crewai`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`

## Endpoints

- Health check endpoint: `/api/health/`
- Application root: `/`

## Optional CI/CD Auto-Deploy

If using GitHub Actions auto-deploy:

1. Open repository settings in GitHub.
2. Add secret `RENDER_DEPLOY_HOOK_URL`.
3. Use `.github/workflows/deploy-render.yml` to trigger deploy after CI success.
