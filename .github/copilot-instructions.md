<!-- Auto-generated guidance for AI coding agents in this repo -->
# Copilot / AI Agent Instructions

Purpose: fast orientation for code-writing agents to be immediately productive in this Vite + React + Supabase project.

**Big Picture**
- **Frontend:** Vite + React + TypeScript single-page app. Entry is [src/main.tsx](src/main.tsx).
- **Data + Auth:** Supabase is used as the backend (client only); see [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts). Sessions persist to `localStorage`.
- **Fetching/state:** `@tanstack/react-query` is used for async data; local state via hooks (see `src/hooks`).
- **UI:** shadcn-ui components live under [src/components/ui](src/components/ui). App-level routing is in [src/App.tsx](src/App.tsx).

**Key files to read first**
- [package.json](package.json): scripts (`dev`, `build`, `preview`, `lint`) and dependencies.
- [vite.config.ts](vite.config.ts): dev server (host `::`, port `8080`), `@` alias → `src`, and the `lovable-tagger` dev plugin.
- [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts): Supabase client creation and required env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [src/hooks/useAuth.ts](src/hooks/useAuth.ts): canonical auth patterns (signIn/signUp/signOut, role checks against `user_roles`).
- [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx): how route protection is enforced in the app.

**Developer workflows**
- Install: `npm i` (Node/npm required). Start dev server: `npm run dev` (Vite host/port configured in `vite.config.ts`).
- Build: `npm run build` (or `npm run build:dev` for development-mode build). Preview: `npm run preview`.
- Lint: `npm run lint`.

**Repository conventions & patterns**
- Use absolute imports via the `@` alias (examples: `@/components`, `@/integrations/supabase/client`). Keep imports consistent.
- Add React Router routes in [src/App.tsx](src/App.tsx) — place new routes above the catch-all `*` route (there is a comment reminding this).
- Auth role checks: `useAuth` queries the `user_roles` table and treats presence of `hr_admin` as elevated access. Follow this pattern when enforcing admin-only UI.
- Generated files: `src/integrations/supabase/client.ts` contains a header saying it's auto-generated — do not edit it directly. DB migrations live in `supabase/migrations`.
- UI components follow shadcn conventions; prefer reusing components in [src/components/ui] rather than creating one-offs.

**Integration notes & environment**
- Supabase env vars: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your `.env`/deployment environment. Client is created with `persistSession: true` and `localStorage` storage.
- React Query: top-level `QueryClientProvider` is in [src/App.tsx](src/App.tsx); register new queries/mutations using the same client patterns.

**Quick examples**
- Import supabase: `import { supabase } from "@/integrations/supabase/client";`
- Use auth hook: check `isHrAdmin` from `useAuth()` to gate HR admin UI.

**Editing guidance for agents**
- Do not modify auto-generated files (look for the "automatically generated" header).
- Keep route additions local to `src/App.tsx` and use `ProtectedRoute` for protected screens.
- Preserve the `@` alias and Vite config changes unless you understand cross-cutting build impacts.

If anything here is unclear or you want more examples (e.g., common query patterns, a sample mutation, or where to add tests), tell me which section to expand.
