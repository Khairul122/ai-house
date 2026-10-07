# AI House

Sistem orkestrasi agen AI multi-divisi yang meniru struktur operasional perusahaan.

## Arsitektur

- **Monorepo:** `packages/shared`, `apps/api` (NestJS + Fastify), `apps/web` (React + Vite + Tailwind).
- **Database:** SQLite (WAL mode) dengan Drizzle ORM.
- **Divisi:** 10 divisi terkonfigurasi di `house/divisions/*.md`.
- **Keamanan & Risiko:** 5 tingkat risiko (Level 0 sampai Level 4).
- **Integrasi:** Telegram Bot (grammY) & Web Dashboard.
- **Model Endpoint:** 9router (`http://localhost:20128/v1`).

## Cara Menjalankan

1. Salin `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```
2. Pasang dependensi monorepo:
   ```bash
   pnpm install
   ```
3. Bangun paket dan aplikasi:
   ```bash
   pnpm build
   ```
4. Jalankan backend API:
   ```bash
   pnpm --filter @ai-house/api dev
   ```
5. Jalankan web dashboard:
   ```bash
   pnpm --filter @ai-house/web dev
   ```

Atau jalankan menggunakan Docker Compose:
```bash
docker-compose up -d
```
