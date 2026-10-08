# Ortak PostgreSQL'i tenants klasörüne taşıma

Veritabanı container'ı artık `tenants/deploy/docker-compose.yml` içindeki `db` servisidir (container `shared-db`).
Education, salon ve cms yalnızca bağlanır. DB ayarları (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_PORT`, `DB_LISTEN`) yalnızca tenants `.env` içinde durur.
Veri diski eskisi gibi `education_pgdata`dır (compose'ta `external`), veri taşınmaz.

Sunucuda sırayla (kısa kesinti olur):

1. Education klasöründeki `pg_hba.conf` ve `pg-ssl/` dizinini tenants deploy klasörüne kopyala.
2. Education `.env` içindeki `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_PORT`, `DB_LISTEN` değerlerini tenants `.env` dosyasına aynen ekle. Education `.env` içinde `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_PORT` bağlantı için kalır; `DB_LISTEN` silinir.
3. Eski container'ı durdur: `docker stop education-db && docker rm education-db`
4. Tenants klasöründe: `docker compose up -d db`
5. Education klasöründe yeni compose ile: `docker compose up -d`
6. Kontrol: `docker exec shared-db pg_isready -h 127.0.0.1 -p $DB_PORT`, sonra kurum adresleri.

Geri dönüş: `docker rm -f shared-db`, education'ın eski `docker-compose.yml` sürümüyle `docker compose up -d`.
