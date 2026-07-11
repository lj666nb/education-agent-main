#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="/opt/education-agent-main"
LOG_FILE="/var/log/edu-agent-auto-update.log"
GITHUB_ARCHIVE="https://codeload.github.com/lj666nb/education-agent-main/zip/refs/heads/main"
TEMP_DIR="/tmp/edu-agent-update"
LOCK_FILE="/run/lock/education-agent-update.lock"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    exit 0
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

LATEST_HASH=$(curl -fsSL --connect-timeout 30 --max-time 60 \
    -H "Accept: application/vnd.github.sha" \
    "https://api.github.com/repos/lj666nb/education-agent-main/commits/heads/main" || true)

if [[ ! "$LATEST_HASH" =~ ^[0-9a-f]{40}$ ]]; then
    log "ERROR: could not fetch the latest commit hash; update skipped"
    exit 0
fi

CURRENT_HASH=$(cat "$REPO_DIR/.current_hash" 2>/dev/null || true)
if [[ "$LATEST_HASH" == "$CURRENT_HASH" ]]; then
    log "No updates available (hash: ${LATEST_HASH:0:8})"
    exit 0
fi

log "New version detected: ${CURRENT_HASH:0:8} -> ${LATEST_HASH:0:8}"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
curl -fL --connect-timeout 30 --max-time 180 -o "$TEMP_DIR/repo.zip" "$GITHUB_ARCHIVE"
unzip -q "$TEMP_DIR/repo.zip" -d "$TEMP_DIR"

mkdir -p "/opt/backups/education-agent/auto"
tar --exclude='./data' --exclude='./uploads' --exclude='./frontend/node_modules' \
    -C "$REPO_DIR" -czf "/opt/backups/education-agent/auto/code-$(date +%Y%m%d-%H%M%S).tar.gz" .

# Runtime secrets/data and the server production layer are server-owned.
rsync -a \
    --exclude='.env' \
    --exclude='data' \
    --exclude='uploads' \
    --exclude='.current_hash' \
    --exclude='auto-update.sh' \
    --exclude='docker-compose.prod.yml' \
    --exclude='Dockerfile.frontend.prod' \
    "$TEMP_DIR/education-agent-main-main/" "$REPO_DIR/"

cd "$REPO_DIR"
"${COMPOSE[@]}" build --pull backend frontend code-runner
"${COMPOSE[@]}" up -d --remove-orphans

for _ in $(seq 1 40); do
    backend_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ea-backend 2>/dev/null || true)
    frontend_status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' ea-frontend 2>/dev/null || true)
    if [[ "$backend_status" == "healthy" && "$frontend_status" == "healthy" ]]; then
        echo "$LATEST_HASH" > "$REPO_DIR/.current_hash"
        rm -rf "$TEMP_DIR"
        log "Update completed successfully"
        exit 0
    fi
    sleep 3
done

log "ERROR: containers did not become healthy after update"
exit 1
