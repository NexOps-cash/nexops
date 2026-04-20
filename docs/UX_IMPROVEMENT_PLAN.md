# UX improvement plan

Branch: `ux-improvement`  
Purpose: Reduce confusion, align language, fix dead ends, and make the primary workflow obvious (edit → compile → deploy).

---

## Goals

1. **Clarity** — One name per feature; no jargon in default UI (MCP, BYOK surfaced in settings/help).
2. **Trust** — No fake metrics; settings and navigation do what they promise.
3. **Consistency** — Shell behavior (panels, terminal) predictable across modes.
4. **Accessibility** — Not icon-only navigation for critical paths; keyboard and screen reader basics.

---

## Phase 1 — Navigation and copy (high impact, low risk)

| Task | Description | Primary files |
|------|-------------|----------------|
| 1.1 | Align activity bar labels with sidebar titles (e.g. Interact vs Spend vs Transaction Builder — pick one set). | `WorkbenchLayout.tsx`, `ProjectWorkspace.tsx` |
| 1.2 | Wire **Settings** to open real settings modal or hide until implemented. | `WorkbenchLayout.tsx`, `App.tsx` / parent |
| 1.3 | Document or remove duplicate “deploy” entry points (activity bar vs sidebar) with a short tooltip or onboarding note. | `WorkbenchLayout.tsx`, `Deployment` usage |
| 1.4 | Replace technical offline messages with plain language (“Connect your AI key in Settings” vs raw MCP errors) in default chat paths. | `ProjectWorkspace.tsx`, `AIPanel.tsx` |

---

## Phase 2 — Layout and shell

| Task | Description | Primary files |
|------|-------------|----------------|
| 2.1 | When **Flow** mode hides the bottom panel, show a non-blocking hint (“Terminal minimized in Flow — restore from …”) or keep a slim strip. | `WorkbenchLayout.tsx` |
| 2.2 | Audit horizontal flex chain: `min-w-0`, `overflow-hidden` on panel wrappers so editor/right content never clips. | `WorkbenchLayout.tsx`, editor wrapper |
| 2.3 | Optional: persistent **Terminal / Output / Problems** tabs in bottom panel for parity with power users (if product agrees). | `WorkbenchLayout.tsx`, `NamedTaskTerminal.tsx` |

---

## Phase 3 — Onboarding and hierarchy

| Task | Description | Primary files |
|------|-------------|----------------|
| 3.1 | First-run checklist or overlay: Files → Compile → Deploy → Wallet (skippable). | New component + `ProjectWorkspace.tsx` |
| 3.2 | Single **primary journey** strip (step indicator) for new projects. | `ProjectWorkspace.tsx` |
| 3.3 | Tone down dashboard placeholder stats or replace with real aggregates. | `Dashboard.tsx` / landing |

---

## Phase 4 — Terminal and density

| Task | Description | Primary files |
|------|-------------|----------------|
| 4.1 | Default terminal to “last action” or SYSTEM-only for new users; advanced multi-channel behind expand. | `NamedTaskTerminal.tsx` |
| 4.2 | Increase section title size / contrast for scanability (sidebar headers, panels). | Global tokens / `WorkbenchLayout.tsx` |

---

## Phase 5 — Auth and routing (polish)

| Task | Description | Primary files |
|------|-------------|----------------|
| 5.1 | Clearer “Sign in to edit” on gated routes; optional read-only demo. | `App.tsx`, `RequireAuth` |
| 5.2 | Subdomain / persona navigation copy tested once per flow (app vs docs vs registry). | `App.tsx`, `TopNav.tsx` |

---

## Definition of done (per phase)

- No dead **Settings** click without feedback.
- Naming spreadsheet: same user-facing string for each mode in tooltips, headers, and docs links.
- Layout resize smoke test: sidebar, editor, optional right area — no horizontal clip at common widths.
- New or updated **user-facing** strings reviewed for jargon.

---

## References

- Internal UX review notes (activity bar, duplicate deploy, FLOW hides terminal, dashboard placeholders, expert jargon).
