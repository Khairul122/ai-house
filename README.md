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

## Menjalankan agen sungguhan

Tugas dijalankan oleh OpenCode lewat `opencode serve`. Server ini memakai kata sandi, jadi tetapkan sendiri agar tidak berganti setiap kali dinyalakan:

1. Isi `OPENCODE_SERVER_PASSWORD` di `.env` dengan kata sandi pilihan Anda.
2. Jalankan OpenCode dengan kata sandi yang sama (PowerShell):
   ```powershell
   $env:OPENCODE_SERVER_PASSWORD = "kata-sandi-anda"; opencode serve --port 4096
   ```
3. Pastikan 9router aktif, dan model di `house/divisions/*.md` (mis. `9router/default-model`) terdaftar di konfigurasi OpenCode Anda.

Untuk mencoba alur tanpa model, set `AGENT_RUNTIME=fake`. PM membuat rencana tiruan, dan divisi Dev meminta izin `npm install express` supaya alur persetujuan bisa dicoba.

## Alur proyek

1. Buat proyek di dashboard (Resepsionis) atau kirim tujuan ke bot Telegram.
2. Tekan **Minta PM menyusun rencana**. PM menulis `plan.json` di workspace proyek.
3. Setujui atau tolak rencana. Setelah disetujui, tugas berjalan sesuai ketergantungan, maksimal `MAX_CONCURRENT_RUNS` sekaligus.
4. Aksi berisiko level 3 menunggu keputusan Anda di dashboard atau Telegram, dan otomatis ditolak setelah `APPROVAL_TIMEOUT_MIN` menit. Level 4 selalu ditolak.
5. Tugas gagal bisa dicoba lagi. **Hentikan proyek** atau `/stop` di Telegram membatalkan semua run.

Atau jalankan menggunakan Docker Compose:
```bash
docker-compose up -d
```
