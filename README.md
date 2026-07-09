# shophub

Management platform where users create and configure their e-commerce storefronts. Each storefront is provisioned as an isolated Kubernetes workload via the Shop operator.

## Structure

```
shophub/
├── api/          # NestJS + Fastify backend
├── web/          # Next.js frontend
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- Docker
- kubectl (for Kubernetes integration)

## Local development

**1. Start the database**

```bash
docker compose up -d
```

**2. Configure environment**

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local
# Edit api/.env and set DATABASE_URL, JWT_SECRET
```

**3. Run the API**

```bash
cd api
npm install
npm run start:dev     # http://localhost:3000
```

**4. Run the web app**

```bash
cd web
npm install
npm run dev           # http://localhost:3001
```

## Database

PostgreSQL is provisioned via `docker-compose.yml` for local development. In production, it is managed by the CNPG operator via the `shophub` Helm chart.

To connect from the API, set `DATABASE_URL` in `api/.env`:

```
DATABASE_URL=postgresql://shophub:changeme@localhost:5432/shophub
```

## Observability

The API exports Prometheus metrics (`/metrics`), structured JSON logs (pino), and OpenTelemetry traces. This is self-monitoring — the per-Shop dashboards/alerts (spec §4.1) come from `shop-operator` and cover the `shop` app, not this one. See `kube-state`'s README for how to access Grafana.
