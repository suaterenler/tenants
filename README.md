# Tenants

Education, Salon, CMS ve E-Ticaret programlarının kurumlarını tek ekrandan yöneten Kurum Yönetimi uygulaması. Veritabanı yoktur; her program kendi kurum listesini tutar, bu uygulama onların agent API'sini çağırır. Ayrıntılar: `AGENTS.md`.

## Kurulum

1. `cp .env.example .env.local` ve değerleri doldurun (`PLATFORM_SECRET` programlardaki `TENANTS_SECRET` ile aynı olmalıdır)
2. `npm install`
3. `npm run dev` → http://localhost:3050/admin

Program adresleri `.env.local` içinde tanımlıdır; yerelde varsayılanlar Education 3052, Salon 3054, CMS 3057, E-Ticaret 3059'dur.

## Komutlar

- `npm run typecheck`, `npm run lint`, `npm run test`
- `npm run build`, `npm start` (port 3050)
- `npm run verify:build`: commit edilmiş sürümü temiz kopyada Docker derlemesi gibi derler
