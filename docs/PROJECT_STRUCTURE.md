# Project structure

The repository is organized around its two application frameworks. Runtime data,
credentials, build products, and temporary debugging files must not be mixed into
their source directories.

```text
app/                 FastAPI backend
  api/               HTTP routes and dependencies
  core/              configuration and shared infrastructure
  crud/              persistence access helpers
  db/                database clients and migration runner
  models/            ORM/domain models
  schemas/           request and response schemas
  services/          business and AI services
  seed_data/         versioned seed content
  scripts/           backend data-maintenance scripts
frontend/            React + TypeScript + Vite frontend
  src/               pages, components, API clients, state, types, utilities
  public/            versioned static assets
migrations/          PostgreSQL migrations
runner/              isolated code-execution service
mcp_servers/         optional MCP integrations
scripts/             server and maintenance commands
tests/               automated tests
docs/                product, architecture, and development documentation
request/             source PRDs and requirements (documentation only)
data/, uploads/      server runtime data (not source code)
```

Deployment files remain at the repository root because the Docker build context is
the full project: `docker-compose.yml` is for local development and
`docker-compose.prod.yml` is the production override. Use
`scripts/update.sh` for manual or scheduled production updates; it delegates to
`scripts/server-auto-update.sh`, which verifies the Compose configuration, rebuilds
the three application images, recreates their containers, and checks the API and
web entry point before reporting success.

Ignored generated artifacts include frontend Vite timestamps, debugging bundles,
Node modules, frontend build output, and runtime data. They should never be added
to `app/` or `frontend/src/`.
