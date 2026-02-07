# OpenClaw Projects

Marsan's deployment playground. Push to `main` to auto-deploy to Cloud Run.

## Setup

- **GCP Project:** openclaw-test-486715
- **Region:** europe-west1
- **Auth:** Workload Identity Federation (no keys!)

## Deploy

Just push to main:
```bash
git push origin main
```

GitHub Actions will:
1. Build Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
