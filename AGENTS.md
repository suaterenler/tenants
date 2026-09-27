# TENANTS — Erenler Kurum Yönetimi

Tüm programların (Education, Salon, …) kurumlarını tek ekrandan yöneten uygulama. DB yok; her program kendi kurum listesini tutar, bu uygulama onların agent API'sini çağırır. Aynı imajda özel alan adlarını programlara dağıtan **edge** servisi de vardır.

## Teknik Özet
- Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn (base-ui), basePath `/admin`
- Port: **3050** (`npm run dev` → http://localhost:3050/admin)
- Giriş: `TENANTS_PASSWORD` (env, ilk şifre; eski ad `PLATFORM_PASSWORD` de okunur) → sonra `data/admin.json` (bcrypt, versiyonlu). JWT (`SESSION_SECRET`), sessionStorage `erenler_tenants_token`. "Şifremi unuttum" → `ADMIN_EMAIL`'e 10 dk tek kullanımlık link
- Programlar: `src/server/apps.ts` → `programList()` (key, ad, publicPath, publicUrl, agentUrl, rootUrl). Yeni program = bir satır + o programda agent API + öneksiz (root) imaj
- Agent sözleşmesi (`<agentUrl>/admin/api/agent`, `Authorization: Bearer TENANTS_SECRET`; eski ad `PLATFORM_SECRET` de okunur):
  - `GET /tenants` · `POST /tenants` → `{ tenant, adminPassword }` · `PATCH|DELETE /tenants/:slug`
  - `POST /tenants/:slug/reset-admin` → `{ password }` · `GET /tenants/:slug/backup/(database|files)` → zip · `GET /modules` · `GET /usage`
  - Kurum kaydı: name, contactName, phone, email, expiresAt, active, disabledModules, domains
- Referans agent: Education/Salon (`src/app/admin/api/agent`, `src/server/tenant-agent.ts`, `src/server/tenant-registry.ts`, kayıt dosyası `uploads/_tenants/tenants.json`)

## Özel alan adları
- Kurumun `domains` alanı (Yönetim → Genel sekmesi). Alan adı tüm programlarda tekil olmalı (`domainConflict`)
- `GET /admin/api/domains` (Bearer TENANTS_SECRET) → `{ routes: [{ domain, app, slug, target }], complete }`
- `edge/server.mjs` (bağımlılıksız, port 3060): Apache'nin `app.erenleryazilim.com` dışındaki hostlarını alır, tabloya göre programın **öneksiz imajına** (`rootUrl`, örn. salon 3144, education 3143) Host + X-Forwarded-Host korunarak iletir. Tablo 30 sn'de bir, bilinmeyen host için en fazla 5 sn'de bir yenilenir
- Öneksiz imaj: `NEXT_PUBLIC_BASE_PATH=""`, `NEXT_PUBLIC_HOST_MODE=1`, tag `root-latest`. Proxy kurumu hosttan bulur, `/<kurum>/...` rotasına iç rewrite yapar; linkler öneksiz, localStorage anahtarları alan adına özel. Migration'ları önekli container yapar (`SKIP_DB_DEPLOY=1`)

## Ev Kuralları
- Kodda yorum yok; `any` yok. UI metinleri `messages/tr.ts` + `messages/en.ts` birlikte
- Her değişiklikten sonra `npx tsc --noEmit` + `npm run lint` + `npm run test`
- Commit/push yalnızca kullanıcı onayıyla; mesajlar kısa ve İngilizce

## Yayın
- main'e push → GitHub Actions → `ghcr.io/suaterenler/tenants` (app + edge aynı imaj)
- Sunucu: `/home/erenler/app.erenleryazilim.com/tenants/` (compose: `app` 127.0.0.1:3050, `edge` 127.0.0.1:3060; .env; update.sh; cron 2 dk)
- `TENANTS_SECRET` Education ve Salon `.env` ile aynı olmalı

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
