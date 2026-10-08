#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Starting Barber App Infrastructure Stack "
echo "=========================================="

# Check Docker availability
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not available in PATH."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "[ERROR] Docker daemon is not running. Please start Docker engine."
    exit 1
fi

echo "[1/3] Docker environment detected."

# Boot containers via Docker Compose
echo "[2/3] Starting MySQL 8.0 & Redis 7.0 containers..."
if docker compose version &> /dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

# Function to wait for container healthcheck
wait_for_health() {
    local container_name=$1
    local max_retries=30
    local count=0

    echo "Waiting for container '$container_name' to become healthy..."
    until [ "$(docker inspect --format='{{json .State.Health.Status}}' "$container_name" 2>/dev/null)" == "\"healthy\"" ]; do
        sleep 2
        count=$((count + 1))
        if [ "$count" -ge "$max_retries" ]; then
            echo "[ERROR] Container '$container_name' failed to pass healthcheck after $((max_retries * 2)) seconds."
            docker logs "$container_name" --tail 20
            exit 1
        fi
    done
    echo "[OK] Container '$container_name' is healthy and ready."
}

# Wait for both services
echo "[3/3] Verifying container health..."
wait_for_health "barber_mysql"
wait_for_health "barber_redis"

echo "=========================================="
echo " Infrastructure Started Successfully!     "
echo " MySQL: port 3306 (database: barber_saas) "
echo " Redis: port 6379                        "
echo "=========================================="
