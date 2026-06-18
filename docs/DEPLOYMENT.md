# Deployment guide

NexOps ships as a Vite frontend (Vercel) plus Supabase (auth, projects, registry edge functions).

## Frontend (Vercel)

1. Connect the GitHub repo to Vercel.
2. Set environment variables from [`.env.example`](../.env.example) in the Vercel project settings.
3. Build command: `npm run build`
4. Output directory: `dist`

Local preview after build:

```bash
npm run build
npm run preview
```

## Supabase

### Database migrations

Apply registry and projects migrations in order:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or use the npm script (default project ref in `package.json`):

```bash
npm run supabase:db-push
```

Key migrations live under `supabase/migrations/` (projects RLS, `contracts_registry`, audit log, publish RPC).

### Edge function: publish-contract

CLI deploy (uses `index.ts` + `_shared/registryGate.ts`):

```bash
npm run supabase:deploy-publish
```

**Supabase Dashboard paste deploy:** use `supabase/functions/publish-contract/index.dashboard.ts` as the single `index.ts` file. Keep it in sync via:

```bash
npm run sync:registry-gate
```

### Registry gate sync

Canonical logic: `lib/registryGate.ts`. CI runs:

```bash
npm run sync:registry-gate -- --check
```

## Quality checks (match CI)

```bash
npm ci
npm run sync:registry-gate -- --check
npm run typecheck
npm test
npm run wizard:compile-matrix
```

Chipnet live integration scripts (`npm run chipnet:live-test*`) are manual / optional — network-dependent.
