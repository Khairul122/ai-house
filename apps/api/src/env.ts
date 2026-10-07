import path from "node:path";
import dotenv from "dotenv";

// Di-import paling awal oleh main.ts agar variabel tersedia sebelum modul lain (mis. koneksi DB) dibaca.
// Mencari .env di folder kerja dulu, lalu di akar monorepo (saat dijalankan dari apps/api).
dotenv.config({ path: [path.resolve(".env"), path.resolve("../../.env")] });
