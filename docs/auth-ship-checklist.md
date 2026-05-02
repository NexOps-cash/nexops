# Auth / workspace ship checklist

Manual flows to run before merging `auth-centralization-workspace-sync`:

1. **Fresh tab workspace** — `/workspace/:id` logged out → `/login?return=…` → sign in → returns to workspace.
2. **OAuth cancel** — start GitHub OAuth, cancel → optional `?error=` clears redirect guard; retry protected route works.
3. **Wizard hash** — `/wizard#nxw=<payload>` logged out → after login, wizard restores state (hash preserved via `oauth_pending_return`).
4. **Workspace refresh** — logged in, hard refresh workspace → “Checking access…” then “Loading workspace…” then IDE.
5. **Multi-tab** — log out in one tab; other tab picks up session change (~100ms debounced storage listener).
6. **DNS** — point `wiz.nexops.cash` → `https://app.nexops.cash/wizard` (301) if old links exist.

Supabase: apply `supabase/migrations/20260203100000_projects_rls.sql` (owner-only RLS on `projects`).
