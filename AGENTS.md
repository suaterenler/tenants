# TENANTS — Erenler Kurum Yönetimi

Tüm programların (Education, Salon, …) kurumlarını tek ekrandan yöneten uygulama. DB yok; her program kendi kurum listesini tutar, bu uygulama onların agent API'sini çağırır.

## Teknik Özet
- Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn (base-ui), basePath `/admin`
- Port: **3050** (`npm run dev` → http://localhost:3050/admin)
- Giriş: `PLATFORM_PASSWORD` (env) → JWT (`SESSION_SECRET`), sessionStorage
- Programlar: `src/server/apps.ts` → `platformApps()` (key, ad, public path, agent URL). Yeni program = bir satır + o programda agent API
- Agent sözleşmesi (`<agentUrl>/admin/api/agent`, header `x-platform-key: PLATFORM_SECRET`):
  - `GET /tenants` → kurum kayıtları · `POST /tenants` → `{ tenant, adminPassword }`
  - `PATCH /tenants/:slug` (name, contactName, phone, email, expiresAt, active, disabledModules)
  - `POST /tenants/:slug/reset-admin` → `{ password }` · `GET /modules` → `[{ key, label }]`
- Referans agent uygulaması: Education (`src/app/admin/api/agent`, `src/server/platform.ts`, `src/server/tenant-registry.ts`)

## Ev Kuralları
- Kodda yorum yok; `any` yok. UI metinleri `messages/tr.ts` + `messages/en.ts` birlikte
- Her değişiklikten sonra `npx tsc --noEmit` + `npm run lint`

## Yayın
- master'a push → GitHub Actions → `ghcr.io/suaterenler/tenants`
- Sunucu: `/home/erenler/app.erenleryazilim.com/tenants/` (compose, .env, update.sh; cron 2 dk). Container host network, 127.0.0.1:3050
- `PLATFORM_SECRET` Education `.env` ile aynı olmalı

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
