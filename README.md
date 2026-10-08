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

## Pemakaian sehari-hari (produksi lokal)

```bash
pnpm house:start
```

Skrip ini menyalakan 9router (bila belum jalan), OpenCode khusus House di port dari `OPENCODE_SERVER_URL` (bawaan 4097, terpisah dari OpenCode pribadi Anda di 4096), lalu API + dashboard di `http://127.0.0.1:3000`. Build dibuat otomatis saat pertama kali. Log ada di `data/logs/`.

```bash
pnpm house:stop
```

Menghentikan API dan OpenCode House. 9router dibiarkan karena dipakai alat lain (tambahkan `-All` di skrip untuk ikut mematikannya). Setelah mengubah kode, jalankan `pnpm build` lalu start ulang.

Agar menyala otomatis saat login Windows, daftarkan sekali (jalankan sendiri di PowerShell):

```powershell
schtasks /Create /TN "AI House" /SC ONLOGON /TR "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File D:\portofolio\ai-house\scripts\start-house.ps1 -NoBrowser"
```

### Keamanan

- Server hanya mendengar di `127.0.0.1`, jadi tidak bisa dibuka dari perangkat lain. Dari ponsel, pakai bot Telegram.
- Permintaan yang mengubah data wajib membawa header `X-House`, sehingga situs lain yang Anda buka tidak bisa menyetujui aksi atas nama Anda.
- Setiap workspace mendapat `opencode.json` yang membuat semua aksi agen bertanya dulu ke House. Agen tidak boleh mengubah berkas itu.
- Halaman hasil kerja dibuka dalam sandbox, sehingga skrip buatan agen tidak bisa memanggil API House.

### Model

Pilih model atau kombo 9router per divisi di dashboard (panel Divisi). Pilihan disimpan ke `house/divisions/<id>.md`.

Dashboard hanya menampilkan data nyata dari server. Tidak ada mode demo atau data tiruan; runtime tiruan hanya dipakai di tes (`apps/api/test/support`).

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
