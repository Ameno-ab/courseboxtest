# Coursebox Skill-Match Prototype

Next.js full-stack prototype for:

- importing Coursebox course metadata into MongoDB
- storing candidate skills and course skills
- recommending courses by skill overlap
- launching courses from your UI (LTI 1.3 when configured, direct URL fallback)
- ingesting completion updates from Zapier webhooks

## Tech Stack

- Next.js 16 (App Router + API routes)
- MongoDB
- Docker + Docker Compose
- TypeScript + Zod + JOSE

## Quick Start (Docker)

1. Start services:

```bash
docker compose up --build
```

2. In another terminal, initialize indexes and seed demo data:

```bash
docker compose exec app npm run db:ensure-indexes
docker compose exec app npm run db:seed
```

3. Open http://localhost:3000

## Quick Start (Local without Docker)

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Set `MONGODB_URI` in `.env.local` to either a local Mongo (`mongodb://localhost:27017/coursebox_prototype`) or your Atlas SRV string.

3. Install and run:

```bash
npm install
npm run db:ensure-indexes
npm run db:seed
npm run dev
```

## Deploy to Vercel + MongoDB Atlas

1. **Create an Atlas cluster** (free M0 tier is fine):
   - Atlas → Database → Create → choose region close to your Vercel deployment.
   - Database Access → add a database user (password auth).
   - Network Access → add `0.0.0.0/0` (Vercel's serverless IPs are not fixed).
   - Connect → Drivers → Node.js → copy the SRV connection string.

2. **Push this repo to GitHub**, then in Vercel: New Project → Import the repo.
   Vercel auto-detects Next.js; no overrides needed.

3. **Set environment variables** in Vercel → Settings → Environment Variables:
   - `MONGODB_URI` — the Atlas SRV string (URL-encode the password).
   - `MONGODB_DB` — e.g. `coursebox_prototype`.
   - `LTI_PLATFORM_ISSUER` — `https://your-domain.com`.
   - `LTI_TOOL_CLIENT_ID`, `LTI_DEPLOYMENT_ID`, `LTI_TARGET_LINK_URI`, `COURSEBOX_LTI_LAUNCH_URL`.
   - `LTI_KEY_ID`, `LTI_PLATFORM_PRIVATE_KEY_PEM` (paste full multiline PEM), `LTI_PLATFORM_PUBLIC_JWKS`.
   - `ZAPIER_WEBHOOK_SECRET` (optional).
   - `COURSEBOX_EMBED_BASE_URL` (used only when LTI vars are not all set).

4. **Add your custom domain** in Vercel → Settings → Domains and update DNS.

5. **Initialize the Atlas database** from your local machine — point your local
   `.env.local` `MONGODB_URI` at Atlas and run:

   ```bash
   npm run db:ensure-indexes
   npm run db:seed
   ```

6. **Verify** `https://your-domain.com/api/health` returns `{ ok: true }`.

Notes:
- `next.config.ts` declares `mongodb` as an external package so Vercel does not try to bundle the native driver.
- Connection caching across function invocations is handled in `src/lib/db.ts` via `globalThis`.
- The Docker setup remains for local-only convenience and is not used by Vercel.

## Scripts

- `npm run db:ensure-indexes` create required Mongo indexes
- `npm run db:seed` insert demo candidates/courses
- `npm run cli:import-courses -- --file ./data/courses.sample.json` import/update courses
- `npm run cli:upsert-skills -- --entity candidate --id alice@example.com --skills sales,crm`
- `npm run cli:upsert-skills -- --entity course --id cbx-sales-101 --skills sales,communication`

## API Endpoints

- `GET /api/health` health check with Mongo ping
- `GET /api/candidates` list candidates
- `GET /api/recommendations?candidateId=<id>` ranked skill-match recommendations
- `POST /api/courses/:courseId/launch` start enrollment and return launch payload
- `POST /api/webhooks/zapier` process completion events with idempotency
- `GET /api/.well-known/jwks.json` public JWKS endpoint for LTI

## Zapier Webhook Payload

Send JSON to `POST /api/webhooks/zapier`:

```json
{
	"eventId": "evt_12345",
	"type": "course_completed",
	"candidateEmail": "alice@example.com",
	"courseExternalId": "cbx-sales-101",
	"status": "completed",
	"score": 84,
	"completedAt": "2026-05-05T10:30:00.000Z"
}
```

If `ZAPIER_WEBHOOK_SECRET` is set, include header:

- `x-zapier-secret: <your-secret>`

## LTI Notes

For full LTI mode, configure these in `.env.local` or Docker env:

- `LTI_PLATFORM_ISSUER`
- `LTI_TOOL_CLIENT_ID`
- `LTI_DEPLOYMENT_ID`
- `LTI_TARGET_LINK_URI`
- `COURSEBOX_LTI_LAUNCH_URL`
- `LTI_KEY_ID`
- `LTI_PLATFORM_PRIVATE_KEY_PEM`
- `LTI_PLATFORM_PUBLIC_JWKS`

If those are not set, launch endpoint falls back to `COURSEBOX_EMBED_BASE_URL/<external-course-id>`.
