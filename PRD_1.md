# PRD: AI House

- Versi: 0.1 (draf)
- Tanggal: 7 Oktober 2026
- Pemilik produk: Khairul
- Dokumen pendamping: `implementation_plan.md`

---

## 1. Ringkasan

AI House adalah perangkat lunak yang meniru struktur perusahaan kecil. Setiap bidang kerja menjadi satu divisi. Setiap divisi punya agen AI dengan peran, aturan, dan izin sendiri.

Divisi Product & Project Management (PM) menjadi satu-satunya titik kontak Anda. Anda berbicara dengan PM lewat bot Telegram. PM memecah permintaan menjadi tugas, membagikannya ke divisi lain, memantau hasil, lalu melapor kepada Anda.

Agen berjalan di atas OpenCode CLI. Model AI datang dari 9router lewat satu endpoint kompatibel OpenAI (`http://localhost:20128/v1`). Dashboard web menampilkan seluruh aktivitas secara langsung.

## 2. Masalah

- Pekerjaan lintas bidang (kode, desain, tes, deploy, konten) harus Anda koordinasi sendiri.
- Sesi AI yang terpisah tidak berbagi konteks proyek.
- Tidak ada satu tempat untuk melihat siapa mengerjakan apa, apa yang menunggu persetujuan, dan berapa token terpakai.
- Anda ingin memberi perintah dari ponsel kapan saja.

## 3. Tujuan dan non-tujuan

### Tujuan

| ID | Tujuan |
|----|--------|
| G1 | Satu perintah di Telegram menghasilkan kerja terkoordinasi dari beberapa divisi. |
| G2 | Aksi berisiko selalu menunggu persetujuan Anda. |
| G3 | Divisi baru ditambahkan dengan satu file konfigurasi, tanpa mengubah kode inti. |
| G4 | Dashboard menampilkan status secara langsung dan nyaman dipakai di ponsel. |
| G5 | Basis kode ringan, bersih, dan mudah dilanjutkan di kemudian hari. |

### Non-tujuan (versi 1)

- Banyak pengguna dengan penagihan.
- Marketplace agen.
- Pelatihan atau penyetelan model.
- Aplikasi mobile native.
- Agen yang bekerja penuh otonom tanpa persetujuan.
- Kanal chat selain Telegram.

## 4. Pengguna

Satu pemilik, yaitu Anda. Anda memberi perintah dari ponsel dan memeriksa hasil di laptop.

Versi 2 dapat menambah anggota tim dengan peran terbatas.

## 5. Istilah

| Istilah | Arti |
|---------|------|
| House | Seluruh sistem. |
| Divisi | Satu bidang kerja dengan agen, model, prompt, dan izin sendiri. |
| Agen | Proses OpenCode yang menjalankan peran sebuah divisi. |
| Proyek | Tujuan kerja yang Anda minta. Punya workspace sendiri. |
| Tugas | Satu unit kerja dalam proyek, ditugaskan ke satu divisi. |
| Run | Satu kali eksekusi agen untuk satu tugas. |
| Persetujuan | Permintaan izin kepada Anda untuk aksi berisiko. |
| Workspace | Folder terisolasi untuk file satu proyek. |

## 6. Daftar divisi

House memiliki 10 divisi pada rilis penuh. Divisi PM wajib ada sejak MVP.

| # | Divisi | Tanggung jawab | Keluaran utama |
|---|--------|----------------|----------------|
| 1 | Product & Project Management | Menerima perintah, menyusun rencana, membagi tugas, memantau, melapor. | Rencana, status, laporan |
| 2 | Software/App Development | Menulis, mengubah, dan memperbaiki kode. | Kode, commit, catatan perubahan |
| 3 | QA & Testing | Menulis dan menjalankan tes, melaporkan bug. | Laporan tes, daftar bug |
| 4 | UI/UX Design | Wireframe, design system, tinjauan tampilan. | Spesifikasi UI, token desain |
| 5 | DevOps | CI/CD, kontainer, proses rilis. | Pipeline, Dockerfile, catatan rilis |
| 6 | Infrastructure & Network | Konfigurasi server, jaringan, dan IaC. | File konfigurasi, rencana perubahan |
| 7 | Cybersecurity | Audit kode, pemeriksaan dependensi, tinjauan konfigurasi. Hanya sisi bertahan. | Laporan temuan dan perbaikan |
| 8 | Data Analyst/Scientist | Membersihkan data, analisis, visualisasi, model sederhana. | Notebook, tabel, grafik, ringkasan |
| 9 | Riset & Konten | Riset pasar atau teknis, dokumentasi, penulisan teks produk. | Laporan riset, dokumen |
| 10 | Content Creator | Naskah, caption, jadwal konten, brief visual. | Draf konten, kalender konten |

Catatan: divisi 9 dan 10 berbagi sebagian tugas. Pembagian di atas berlaku sebagai default sampai Anda menjawab pertanyaan terbuka nomor 4.

## 7. Kebutuhan fungsional

Prioritas: **M** = wajib di MVP, **S** = sebaiknya ada, **C** = bisa ditunda.

### 7.1 Telegram dan PM

| ID | Kebutuhan | Prio |
|----|-----------|------|
| FR-01 | Bot hanya menerima pesan dari ID Telegram yang terdaftar. Pesan dari ID lain diabaikan dan dicatat. | M |
| FR-02 | Pesan teks bebas diteruskan ke agen PM. PM membalas dalam bahasa Indonesia. | M |
| FR-03 | Perintah: `/start`, `/status`, `/proyek`, `/tugas`, `/setuju <id>`, `/tolak <id>`, `/batal <id>`, `/divisi`, `/laporan`, `/stop`. | M |
| FR-04 | Permintaan persetujuan tampil dengan tombol Setuju dan Tolak. Isinya: ringkasan aksi, divisi pemohon, tingkat risiko. | M |
| FR-05 | Bot mengirim notifikasi saat tugas selesai, gagal, atau butuh keputusan. | M |
| FR-06 | `/ke <divisi> <pesan>` mengarahkan pesan ke divisi tertentu lewat PM. | S |
| FR-07 | Ringkasan harian terjadwal. Jam dapat diatur. | S |
| FR-08 | Bot mengirim file hasil (md, pdf, zip) ke Telegram. | C |
| FR-09 | Pesan suara diubah menjadi teks. | C |

### 7.2 Orkestrasi

| ID | Kebutuhan | Prio |
|----|-----------|------|
| FR-10 | PM mengubah tujuan menjadi rencana: daftar tugas, divisi, urutan, dan kriteria selesai. | M |
| FR-11 | Proyek baru menunggu persetujuan rencana dari Anda sebelum dieksekusi. | M |
| FR-12 | Status tugas: antre, berjalan, menunggu persetujuan, diblokir, selesai, gagal, dibatalkan. | M |
| FR-13 | Tugas mendukung ketergantungan. Tugas berjalan setelah prasyaratnya selesai. | M |
| FR-14 | Serah terima antardivisi memakai artefak tertulis di workspace, bukan riwayat percakapan. | M |
| FR-15 | Tugas independen berjalan paralel dengan batas konkurensi yang dapat diatur. | S |
| FR-16 | PM menilai hasil terhadap kriteria selesai. PM meminta perbaikan paling banyak N kali. | S |

### 7.3 Divisi dan agen

| ID | Kebutuhan | Prio |
|----|-----------|------|
| FR-17 | Divisi didefinisikan lewat file `house/divisions/*.md`: nama, deskripsi, model, prompt, izin. | M |
| FR-18 | Setiap divisi dapat memakai model berbeda dari 9router. | M |
| FR-19 | Agen berjalan lewat OpenCode. Direktori kerjanya dibatasi pada workspace proyek. | M |
| FR-20 | Konfigurasi divisi dimuat ulang tanpa restart. | S |
| FR-21 | Satu divisi dapat memiliki lebih dari satu agen, misalnya penulis dan peninjau. | C |

### 7.4 Persetujuan dan keamanan

| ID | Kebutuhan | Prio |
|----|-----------|------|
| FR-22 | Sistem menerapkan lima tingkat risiko (bagian 8). | M |
| FR-23 | Aksi tingkat 3 menunggu persetujuan. Jika waktu tunggu habis, sistem menolak aksi itu. | M |
| FR-24 | Aksi tingkat 4 selalu ditolak. | M |
| FR-25 | Audit log mencatat setiap aksi agen: siapa, apa, kapan, hasil. | M |
| FR-26 | Tombol "Hentikan semua" tersedia di Telegram (`/stop`) dan di dashboard. | M |
| FR-27 | Anggaran token per proyek dan per tugas. Tugas berhenti saat batas terlampaui dan meminta keputusan Anda. | S |

### 7.5 Dashboard web

| ID | Kebutuhan | Prio |
|----|-----------|------|
| FR-28 | Halaman **Gedung**: tata letak semua divisi dengan status (siaga, bekerja, menunggu, galat) dan tugas aktif. | M |
| FR-29 | Halaman **Proyek**: daftar, detail, papan tugas, artefak. | M |
| FR-30 | Halaman **Persetujuan**: antrean dan riwayat. Anda dapat memutuskan dari sini. | M |
| FR-31 | Halaman **Aktivitas**: aliran log langsung dengan filter divisi, proyek, dan tingkat risiko. | M |
| FR-32 | Halaman **Divisi**: detail, model, prompt, izin, statistik. | M |
| FR-33 | Halaman **Pengaturan**: koneksi 9router, token Telegram, batas konkurensi, anggaran. | S |
| FR-34 | Edit prompt divisi dari dashboard dengan riwayat versi. | S |
| FR-35 | Obrolan dengan PM langsung dari dashboard. | C |

## 8. Tingkat risiko dan izin

| Tingkat | Nama | Contoh aksi | Perlakuan |
|---------|------|-------------|-----------|
| 0 | Baca | Membaca file workspace, mencari di web. | Otomatis |
| 1 | Tulis di workspace | Membuat atau mengubah file di workspace proyek. | Otomatis, dicatat |
| 2 | Jalankan terbatas | Menjalankan tes, lint, build, `git status`, `git commit`. | Otomatis untuk daftar izin. Di luar daftar, minta persetujuan. |
| 3 | Berisiko | Hapus banyak file, `git push`, merge, deploy, perintah ke server nyata, kirim pesan keluar, pasang paket baru, perubahan jaringan. | Wajib persetujuan lewat Telegram atau dashboard |
| 4 | Terlarang | Akses di luar workspace, membaca kredensial, `git push --force` ke cabang utama, serangan terhadap target tanpa izin tertulis. | Selalu ditolak |

Aturan khusus divisi:

- **Cybersecurity:** hanya aktivitas bertahan. Pemindaian aktif hanya boleh menyasar target pada daftar milik Anda dan selalu tingkat 3.
- **Infrastructure & Network:** agen membuat konfigurasi dan melakukan dry run. Penerapan ke server nyata selalu tingkat 3.
- **DevOps:** deploy selalu tingkat 3.
- **Content Creator:** memposting ke akun media sosial selalu tingkat 3.

## 9. Alur contoh

Permintaan: "Buat landing page untuk toko kopi, deploy ke staging."

1. Anda mengirim pesan itu ke bot Telegram.
2. PM mencatat proyek baru dan mengirim rencana: UI/UX (wireframe), Software Development (halaman), QA (tes dasar), DevOps (deploy staging).
3. Anda menekan **Setuju** pada rencana.
4. UI/UX menulis `design/spec.md` di workspace.
5. Software Development membaca spesifikasi itu dan membangun halaman.
6. QA menjalankan tes dan melaporkan hasil ke PM.
7. DevOps meminta persetujuan deploy. Bot mengirim pesan dengan tombol Setuju dan Tolak.
8. Anda menyetujui. DevOps melakukan deploy.
9. PM mengirim laporan akhir: apa yang selesai, tautan staging, token terpakai.

Seluruh langkah tampil di halaman Aktivitas dan papan tugas proyek.

## 10. Kebutuhan non-fungsional

Angka di bawah adalah target awal. Ukur ulang setelah MVP.

| Area | Kebutuhan |
|------|-----------|
| Ringan | API dan web memakai kurang dari 300 MB RAM saat siaga, di luar OpenCode dan 9router. Tanpa Redis di MVP. |
| Performa | Muat awal dashboard kurang dari 2 detik di jaringan 4G. Pembaruan status tampil kurang dari 1 detik setelah kejadian. |
| Responsif | Berfungsi penuh dari lebar 360 px sampai 1920 px. Halaman Persetujuan dapat dipakai satu tangan di ponsel. |
| Aksesibilitas | Kontras WCAG 2.2 AA. Semua aksi dapat dijangkau dengan keyboard. Status tidak hanya dibedakan lewat warna. |
| Ketahanan | Setelah restart, tugas yang sedang berjalan ditandai ulang dan dapat dilanjutkan atau diulang. |
| Keamanan | Rahasia hanya di variabel lingkungan. Bot memakai daftar ID yang diizinkan. Dashboard memakai login dan cookie HttpOnly. Workspace terisolasi per proyek. |
| Observabilitas | Log terstruktur (JSON). Endpoint `/health`. Audit log dapat dicari. |
| Pemeliharaan | Cakupan tes logika domain minimal 80%. Lint tanpa galat. Struktur modul mengikuti `implementation_plan.md`. |
| Portabilitas | Berjalan dengan Docker Compose. SQLite di MVP. Pindah ke PostgreSQL cukup lewat konfigurasi dan migrasi. |
| Bahasa | Antarmuka dan pesan bot dalam bahasa Indonesia. |

## 11. Persyaratan UI/UX

### Prinsip

1. Tampilkan data nyata terlebih dahulu. Jangan isi layar dengan dekorasi.
2. Satu layar, satu tugas utama.
3. Status selalu terlihat tanpa perlu membuka halaman lain.
4. Keputusan Anda (persetujuan) selalu mudah dijangkau.

### Arah visual

- Tata letak Gedung berupa grid ruangan. Tiap ruangan mewakili satu divisi dan memuat nama, status, tugas aktif, dan waktu aktivitas terakhir.
- Satu warna aksen. Warna lain hanya untuk status: hijau (selesai), kuning (menunggu), merah (galat), abu-abu (siaga).
- Tema terang dan gelap. Mengikuti pengaturan sistem, dapat diubah manual.
- Huruf: IBM Plex Sans untuk teks dan IBM Plex Mono untuk log dan kode. Dihosting sendiri.
- Kerapatan informasi sedang. Tabel dan daftar boleh padat. Tombol tetap berukuran sentuh minimal 44 px.

### Daftar larangan (anti "AI slop")

- Tidak ada gradien ungu atau biru-ungu, tidak ada efek glow, tidak ada glassmorphism berlebihan.
- Tidak ada kartu identik berderet tanpa hierarki.
- Tidak ada emoji sebagai ikon antarmuka. Pakai satu set ikon garis yang konsisten.
- Tidak ada teks pemasaran seperti "Revolusi kerja Anda". Teks antarmuka bersifat fungsional.
- Tidak ada ilustrasi stok atau avatar robot generik.
- Tidak ada animasi yang tidak membawa informasi. Animasi hanya untuk perubahan status dan transisi halaman, dan menghormati `prefers-reduced-motion`.
- Data contoh tidak boleh berupa "Lorem ipsum" atau "John Doe". Empty state menjelaskan langkah berikutnya.

### Perilaku dinamis

- Status divisi, tugas, dan log diperbarui langsung lewat Server-Sent Events.
- Elemen yang berubah menyorot singkat, lalu kembali normal.
- Skeleton saat memuat. Pesan galat menyebut penyebab dan tindakan yang tersedia.
- Daftar panjang memakai paginasi atau virtualisasi.

### Breakpoint

| Lebar | Tata letak |
|-------|------------|
| < 640 px | Satu kolom. Navigasi bawah. Persetujuan tampil sebagai lembar bawah (bottom sheet). |
| 640 - 1024 px | Dua kolom. Sidebar dapat dilipat. |
| > 1024 px | Sidebar tetap. Panel detail di sisi kanan. |

## 12. Metrik keberhasilan

| Metrik | Target |
|--------|--------|
| Waktu dari pesan Telegram sampai pengakuan PM | Kurang dari 10 detik pada 90% pesan |
| Aksi tingkat 3 yang berjalan tanpa persetujuan | 0 |
| Waktu menambah satu divisi baru | Kurang dari 15 menit |
| Proyek kecil selesai tanpa intervensi manual | 70% atau lebih |
| Tugas yang pulih benar setelah restart | 100% |

## 13. Risiko

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| SDK OpenCode mengembalikan respons kosong pada provider kustom OpenAI-compatible (ada laporan di issue publik). | Agen tidak menghasilkan keluaran. | Spike di Fase 0. Siapkan adapter cadangan yang memanggil `opencode run` lewat proses anak. |
| Kuota atau batas laju pada model di 9router (terutama tingkat gratis). | Tugas gagal atau lambat. | Retry dengan jeda, fallback model lewat 9router, batas konkurensi, anggaran token. |
| Prompt injection dari isi web atau file. | Agen menjalankan perintah yang tidak Anda minta. | Isi web diperlakukan sebagai data. Aksi tingkat 3 tetap butuh persetujuan. Workspace terisolasi. |
| Biaya token membengkak karena loop. | Biaya tak terduga. | Batas langkah per run, anggaran per tugas, tombol `/stop`. |
| Token bot Telegram bocor. | Pihak lain mengendalikan bot. | Daftar ID pemilik, rotasi token, rahasia hanya di `.env`. |
| Agen merusak file di luar proyek. | Kehilangan data. | Direktori kerja dibatasi, tingkat 4 ditolak, backup data harian. |

## 14. Asumsi

- Satu pemilik dan satu bot Telegram.
- 9router sudah atau akan berjalan di `http://localhost:20128/v1`.
- OpenCode terpasang di mesin yang sama dengan API House.
- Deploy memakai Docker Compose, di laptop atau VPS Linux.
- "Product/Project Management" dan "Project Manager" dianggap satu divisi.
- Bahasa pesan bot dan dashboard adalah Indonesia.

## 15. Pertanyaan terbuka

Jawaban Anda akan mengubah dokumen ini. Default yang dipakai ditulis di kolom kanan.

| # | Pertanyaan | Default saat ini |
|---|------------|------------------|
| 1 | House dijalankan di laptop atau di VPS? Sistem operasinya apa? | Docker Compose, dapat jalan di keduanya |
| 2 | Model apa saja yang aktif di 9router, dan model mana untuk tiap divisi? | Satu model sama untuk semua, dapat diubah per divisi |
| 3 | Apakah akan ada pengguna Telegram lain (tim) selain Anda? | Hanya satu pemilik |
| 4 | Riset & Konten dan Content Creator dipisah atau digabung? | Dipisah (lihat bagian 6) |
| 5 | Agen boleh `git push` ke GitHub? Akun dan repositori mana? | Boleh, tetapi tingkat 3 |
| 6 | Berapa batas token per tugas dan per proyek? | Belum ditetapkan, perlu angka dari Anda |
| 7 | Cybersecurity dan Infrastructure boleh menyentuh server nyata? Server mana saja? | Hanya dry run dan laporan. Aksi nyata tingkat 3 |
| 8 | Dashboard diakses lewat internet publik atau jaringan privat (misalnya Tailscale)? | Login kata sandi dan cookie. Disarankan jaringan privat |
| 9 | Bahasa kode dan komentar yang dihasilkan agen: Indonesia atau Inggris? | Kode dan komentar Inggris, laporan Indonesia |
| 10 | Apakah ada nama dan warna merek untuk House? | Nama "AI House", satu warna aksen netral hangat |

## 16. Cakupan rilis

### MVP

- Divisi: PM dan Software Development.
- Bot Telegram dengan perintah inti dan tombol persetujuan.
- Orkestrasi dengan rencana, tugas, dan ketergantungan.
- Persetujuan tingkat 0 sampai 4 dan audit log.
- Dashboard: Gedung, Proyek, Persetujuan, Aktivitas.

### Versi 1.0

- Delapan divisi lain lewat file konfigurasi.
- Anggaran token, ringkasan harian, edit prompt dari dashboard.

### Versi 2

- Banyak pengguna dengan peran.
- Beberapa agen per divisi.
- Pindah ke PostgreSQL bila beban menuntut.
- Pesan suara dan kirim file ke Telegram.
