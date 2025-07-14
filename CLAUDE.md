# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Medusa v2 Commerce Platform** starter template repository that provides Docker-based development environment configurations for both backend and storefront components. The project demonstrates how to set up a complete e-commerce solution using the Medusa framework with PostgreSQL, Redis, and Next.js.

## Architecture

The repository contains **configuration templates** rather than actual application code. It provides:

- **Backend Configuration**: Docker setup for Medusa backend with TypeScript configuration
- **Storefront Configuration**: Docker setup for Next.js storefront 
- **Database Services**: PostgreSQL and Redis configuration
- **CI/CD Pipeline**: GitHub Actions workflows for building and deploying Docker images

### Key Components

- `backend/` - Contains Medusa backend configuration files (`medusa-config.ts`, startup scripts)
- `storefront/` - Contains Next.js configuration (`next.config.js`)
- `compose.*.yaml` - Docker Compose files for different service combinations
- `.github/workflows/` - CI/CD pipelines for v1 and v2 builds

## Development Commands

### Database Setup
```bash
# Start database services only
docker compose -f compose.db.yaml up -d

# Seed database with sample data (run once)
docker compose -f compose.seed.yaml run --rm seed
```

### Backend Development
```bash
# Start backend with PostgreSQL and Redis
docker compose up --build -d

# View backend logs
docker compose logs backend-server

# Access backend admin panel: http://localhost:9000/app
# Default credentials: admin@medusa-test.com / supersecret
```

### Storefront Development
```bash
# First: Get publishable key from backend admin panel (Settings)
# Update NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in compose.storefront.yaml

# Start storefront
docker compose -f compose.storefront.yaml up --build

# Access storefront: http://localhost:8000
```

### Full Environment
```bash
# Stop all services
docker compose down && docker compose -f compose.storefront.yaml down

# Clean up volumes (removes all data)
docker compose down -v
```

## Environment Configuration

### Backend Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for caching and events
- `MEDUSA_ADMIN_EMAIL` / `MEDUSA_ADMIN_PASSWORD` - Admin user credentials
- `STORE_CORS` / `ADMIN_CORS` - CORS configuration for frontend access

### Storefront Environment Variables
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` - Required for API communication with backend

## Deployment Architecture

The repository uses GitHub Actions to:
1. Clone official Medusa starter repositories (`medusa-starter-default`, `nextjs-starter-medusa`)
2. Overlay custom configuration files from this repository
3. Build and push Docker images to GitHub Container Registry
4. Support both v1 and v2 Medusa versions on separate branches

## Important Notes

- This repository provides **starter configurations** - actual application code comes from official Medusa repositories
- Backend runs on port 9000, storefront on port 8000
- Database seeding is required after initial setup
- Publishable key must be configured for storefront to communicate with backend
- The `start.sh` script handles database migrations and admin user creation automatically