# Barber Booking System - Step-by-Step Deployment & Release Plan

## Executive Summary
This document provides an end-to-end, production-grade release and deployment procedure for the **Barber Booking SaaS Platform**. It covers environment provisioning, security configurations, database migration protocols, CI/CD automation, and post-release validation.

---

## 1. Release Overview & Architecture

### Component Architecture
* **Frontend**: Responsive Web Client (HTML5, Tailwind CSS, JavaScript ES6, STOMP/SockJS WebSockets).
* **Backend API**: Java 17 + Spring Boot 3 REST APIs & WebSocket Server (Port 8080).
* **Database**: MySQL 8.0 with Flyway Versioned Migration Scripts (`V1__init_schema.sql`).
* **Cache & Lock Manager**: Redis 7.0 + Redisson Distributed Locking for concurrent slot reservation.
* **Containers**: Docker & Docker Compose setup (`docker-compose.yml`).

---

## 2. Pre-Deployment Checklist

Before triggering a production deployment, ensure the following steps pass in a staging/local environment:

### Step 2.1: Local & Automated Code Verification
Run the automated end-to-end test suite to verify concurrent lock safety and database initialization:
```bash
./scripts/verify-e2e.sh
```
*Expected Result*: All 10 parallel thread bookings complete with 1 `200 OK` success and 9 `409 Conflict` responses, zero double-bookings.

### Step 2.2: Secrets & Environment File Audit
- Verify that real credentials (passwords, JWT secret keys, API keys) are **NEVER** committed to Git.
- Prepare production environment variables using `.env.example` as a template:

```bash
cp .env.example .env.production
```

Key Production Variables to Set:
| Variable | Description | Recommended Setting |
| :--- | :--- | :--- |
| `SPRING_DATASOURCE_URL` | MySQL Connection String | `jdbc:mysql://db-prod:3306/barber_saas` |
| `SPRING_DATASOURCE_PASSWORD` | DB Secret Password | High-entropy random string (32+ chars) |
| `JWT_SECRET` | HMAC-SHA256 Secret Key | Cryptographically secure 256-bit string |
| `SPRING_DATA_REDIS_URL` | Redis URL | `redis://redis-prod:6379` |
| `MOYASAR_SECRET_KEY` | Payment Gateway Production Secret | `sk_live_...` |
| `NEXT_PUBLIC_API_URL` | Public HTTPS API Endpoint | `https://api.yourdomain.com/api` |
| `NEXT_PUBLIC_WS_URL` | Public WSS Endpoint | `wss://api.yourdomain.com/ws/websocket` |

---

## 3. Infrastructure Provisioning Strategy

### Option A: Docker Compose Deployment (Single VPS / Small Cloud Instance)

1. **Provision Virtual Server**: Ubuntu 22.04 LTS (minimum 2 vCPU, 4GB RAM).
2. **Install Engine**:
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
   ```
3. **Configure Docker Compose Production Profile**:
   Ensure `docker-compose.yml` mounts production environment variables.

### Option B: Cloud Kubernetes / Managed Container Platform (AWS ECS / GCP Cloud Run / K8s)

- **Database**: AWS RDS for MySQL 8.0 (Multi-AZ for high availability).
- **Cache**: AWS ElastiCache for Redis (Cluster mode enabled).
- **Application**: AWS ECS Fargate or Kubernetes Deployment.

---

## 4. Step-by-Step Deployment Execution Plan

### Step 1: Database Migration Execution
Flyway automatically executes versioned migration scripts located in `backend/src/main/resources/db/migration/`.

1. Test migration dry-run on staging database:
   ```bash
   mvn flyway:info -Dflyway.configFiles=flyway.conf
   ```
2. Apply migration:
   ```bash
   mvn flyway:migrate -Dflyway.configFiles=flyway.conf
   ```
3. **Schema Rollback Strategy**: If migration fails, revert to previous database snapshot created prior to release window.

### Step 2: Backend Container / Jar Build
Compile production artifacts and generate container images:

```bash
# Build Spring Boot executable JAR
cd backend
mvn clean package -DskipTests=false

# Build Docker Image
docker build -t barber-backend:v1.0.0 .
```

### Step 3: Frontend Asset Compilation & Nginx Packaging
Compile Tailwind CSS assets and deploy static files via Nginx reverse proxy:

```bash
# Build Tailwind CSS minified output
cd frontend
npm install
npm run build:css

# Package static bundle or dockerize with Nginx
```

Nginx Reverse Proxy Configuration Snippet:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location / {
        root /var/www/barber-frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws/ {
        proxy_pass http://localhost:8080/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## 5. Automated CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml` for automated testing, image building, and deployment:

```yaml
name: Production CI/CD Pipeline

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Cache Maven packages
        uses: actions/cache@v3
        with:
          path: ~/.m2
          key: ${{ runner.os }}-m2-${{ hashFiles('**/pom.xml') }}

      - name: Run Backend Unit & Integration Tests
        run: |
          cd backend
          mvn test

      - name: Build Backend Jar
        run: |
          cd backend
          mvn package -DskipTests=true

      - name: Log in to Docker Hub / GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & Push Docker Image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: ghcr.io/${{ github.repository }}/backend:latest
```

---

## 6. Post-Deployment Verification & Smoke Tests

After rolling out the release:

1. **Health Check Endpoint**:
   ```bash
   curl -i https://api.yourdomain.com/api/shops
   ```
2. **WebSocket Real-time Slot Lock Test**:
   Verify client connections receive slot reservation broadcasts over WebSocket (`/ws/websocket`).
3. **Payment Webhook Callback Test**:
   Simulate test payment webhook notification to verify booking status transitions from `PENDING_PAYMENT` to `CONFIRMED`.
4. **Log Inspection**:
   Check backend container logs for any runtime errors or connection failures:
   ```bash
   docker logs --tail 100 -f barber-backend-container
   ```

---

## 7. Emergency Rollback Plan

If critical failures are detected during post-release smoke testing:

1. **Divert Traffic**: Instantly point Nginx / Load Balancer to previous stable container version (`v0.9.0`).
2. **Database Rollback**:
   Restore database snapshot taken immediately before Step 4.1 if migration schema changes were disruptive.
3. **Notification**: Send incident alert to operations team via Slack / PagerDuty webhook.
