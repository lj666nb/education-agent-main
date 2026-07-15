#!/usr/bin/env bash
# Safe production updater for the Education Agent Docker Compose deployment.
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/root/education-agent}"
LOG_FILE="${LOG_FILE:-/var/log/edu-agent-auto-update.log}"
LOCK_FILE="${LOCK_FILE:-/run/lock/education-agent-update.lock}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/education-agent/auto}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

mkdir -p "$(dirname "$LOCK_FILE")" "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

log() {
    printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG_FILE"
}

container_state() {
    docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || true
}

wait_for_services() {
    for _ in $(seq 1 40); do
        backend_state=$(container_state ea-backend)
        frontend_state=$(container_state ea-frontend)
        runner_state=$(container_state ea-code-runner)
        neo4j_state=$(container_state ea-neo4j)
        if [[ "$backend_state" == "running healthy" && "$frontend_state" == "running healthy" && "$runner_state" == "running none" && "$neo4j_state" == "running healthy" ]]; then
            curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8000/api/v1/openapi.json >/dev/null &&
            curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/ >/dev/null &&
            return 0
        fi
        sleep 3
    done
    log "ERROR: health check failed (backend=$backend_state frontend=$frontend_state runner=$runner_state neo4j=$neo4j_state)"
    return 1
}

cd "$REPO_DIR"

# Do not overwrite uncommitted operator changes or runtime data.
if ! git diff --quiet || ! git diff --cached --quiet; then
    log "ERROR: working tree has tracked changes; update skipped"
    exit 1
fi

git fetch --prune origin main
local_hash=$(git rev-parse HEAD)
remote_hash=$(git rev-parse origin/main)
if [[ "$local_hash" == "$remote_hash" ]]; then
    log "No updates available (hash: ${local_hash:0:8})"
    exit 0
fi

# A server-local hotfix may be ahead of origin.  It must never be replaced by
# an older remote commit, and a divergent history needs an operator decision.
if git merge-base --is-ancestor origin/main HEAD; then
    log "Local HEAD already contains origin/main (local: ${local_hash:0:8}); update skipped"
    exit 0
fi
if ! git merge-base --is-ancestor HEAD origin/main; then
    log "ERROR: local and origin/main histories diverged; update skipped"
    exit 1
fi

backup_file="$BACKUP_DIR/code-$(date +%Y%m%d-%H%M%S)-${local_hash:0:8}.tar.gz"
tar --exclude='./.git' --exclude='./.env' --exclude='./data' --exclude='./uploads' --exclude='./frontend/node_modules' \
    -czf "$backup_file" .
log "Updating ${local_hash:0:8} -> ${remote_hash:0:8}; backup: $backup_file"

git merge --ff-only origin/main
"${COMPOSE[@]}" config -q
"${COMPOSE[@]}" build --pull backend frontend code-runner
"${COMPOSE[@]}" up -d --remove-orphans --force-recreate backend frontend code-runner
wait_for_services

printf '%s\n' "$remote_hash" > .current_hash
log "Update completed successfully"
