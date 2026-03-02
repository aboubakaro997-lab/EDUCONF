# Production Deployment Guide

## 1) Prerequisites
- Docker + Docker Compose
- DNS pointing to your server
- (Recommended) TLS termination in front of port 8080 (Nginx/Caddy/Cloud LB)

## 2) Configure environment
1. Copy the production template:
   - `cp .env.production.example .env`
2. Edit `.env`:
   - set strong `SECRET_KEY` and `REFRESH_SECRET_KEY` (>=32 chars)
   - set `ALLOWED_ORIGINS` to your frontend domain
   - set `ALLOWED_HOSTS` to your domain(s)
   - set DB credentials and `DATABASE_URL`
   - optionally set `REACT_APP_ICE_SERVERS` with TURN credentials

## 3) Build and run
```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## 4) Verify
- App health: `http://SERVER:8080/`
- API health: `http://SERVER:8080/health`
- API readiness: `http://SERVER:8080/ready`

## 5) Logs
```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

## Notes
- Current realtime state (participants/chat buffer) is in-memory in backend process.
- Scale backend as a single instance unless shared realtime state is externalized.
- For reliable WebRTC in restrictive networks, configure TURN in `REACT_APP_ICE_SERVERS`.
