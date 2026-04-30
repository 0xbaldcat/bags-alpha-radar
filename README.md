# BagsRadar

BagsRadar tracks new Bags token launches and highlights the ones that show early traction.

It keeps a local Postgres snapshot of the Bags launch feed, refreshes token scores on a short loop, and exposes the same data through a small web dashboard. A Telegram sender can be wired to publish scored alerts when a launch crosses the configured threshold.

## What it does

- Reads live token launches from the Bags API.
- Stores launch snapshots and scoring runs in Postgres.
- Scores tokens from holder growth, holder concentration, and early-wallet signals.
- Shows recent launches, scores, and score notes in the web UI.
- Sends Telegram alerts for high-scoring launches when alerting is enabled.

## Local setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The app expects a Postgres URL in `.env.local` when running the stored-data path:

```bash
DATABASE_URL=postgres://user@localhost:5432/bagsradar
```

Run migrations and ingest a first batch:

```bash
pnpm db:migrate
pnpm ingest:launch-feed
```

For continuous local updates:

```bash
pnpm ingest:launch-feed:loop
pnpm score:recompute:loop
```

## Bags API key

Generate a Bags agent key with a dedicated wallet:

```bash
BAGS_AUTH_SECRET_BS58=<base58-secret> pnpm tsx scripts/bags-auth.ts
```

Copy the emitted `BAGS_API_KEY` into `.env.local`. Do not commit wallet secrets or local environment files.

## License

MIT
