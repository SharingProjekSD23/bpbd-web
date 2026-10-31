# SIAGA — Sistem Data Kebencanaan BPBD Kota Semarang

SIAGA adalah proyek website untuk membantu BPBD Kota Semarang dalam mencatat data dan kegiatan, menampilkan informasi melalui dashboard, serta mengelola layanan penelitian. Website ini menyatukan kebutuhan beberapa bidang dalam satu aplikasi, dengan menu dan akses yang mengikuti peran masing-masing pengguna.

Tujuan proyek ini adalah memudahkan pencatatan kegiatan, pemantauan kondisi dan aktivitas bidang, penyusunan laporan, serta pengajuan dan pemanfaatan data untuk penelitian.

**Status saat ini:** aplikasi pengembangan lokal yang terhubung ke PostgreSQL. Login, hak akses, data kegiatan, penelitian, laporan, dan berkas unggahan diproses melalui backend. Data awal serta aturan bisnis masih mengikuti prototipe. Panduan lengkap tersedia di [PostgreSQL lokal](docs/POSTGRESQL-LOKAL.md).

Implementasi awal mengacu pada PRD UI/UX versi 1.0 dan Sitemap Halaman dan Komponen UI versi 1.0, tanggal 8 Oktober 2026. Logo menggunakan aset yang diberikan dalam proyek.

## Pembagian proyek menjadi tiga kelompok

Pengembangan proyek dibagi menjadi tiga kelompok dengan fokus berikut.

| Kelompok             | Fokus                                                                  | Ruang lingkup                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kelompok 1** | **Dashboard Bidang 2**                                           | Berfokus pada pembuatan dashboard untuk Bidang 2, meliputi ringkasan data, indikator, grafik, tabel, dan filter informasi sesuai kebutuhan bidang tersebut.                              |
| **Kelompok 2** | **Penelitian**                                                   | Membahas dan mengembangkan layanan penelitian, mulai dari pendaftaran peneliti, pengajuan permohonan akses data, proses persetujuan, sampai pengumpulan dan peninjauan hasil penelitian. |
| **Kelompok 3** | **Pencatatan, form input, dan dashboard kegiatan setiap bidang** | Mengembangkan pencatatan kegiatan, form untuk menambah dan memperbarui data, riwayat serta status kegiatan, dan dashboard kegiatan pada setiap bidang yang ada.                          |

Kelompok 1 berfokus hanya pada dashboard Bidang 2. Kelompok 3 menangani alur pencatatan dan input kegiatan beserta dashboard kegiatannya di seluruh bidang. Untuk bagian dashboard yang berkaitan, kedua kelompok perlu menyepakati indikator dan sumber data agar hasilnya konsisten. Kelompok 2 menggunakan data sesuai cakupan akses penelitian yang disetujui.

Istilah **Bidang 2** pada pembagian kelompok mengikuti arahan proyek. Kode aplikasi saat ini memakai nama bidang dan kode role pada tabel di bawah, sehingga pemetaan nomor bidang ke nama resminya perlu mengikuti kesepakatan tim.

Ketiga kelompok bekerja pada modul dalam satu website. Pembagian ini merupakan pembagian tanggung jawab pengembangan; kode saat ini menggunakan komponen dan model data bersama.

## Bidang dan pengguna dalam aplikasi

| Pengguna / bidang                    | Kode role | Cakupan dalam prototipe                                                                                                     |
| ------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Admin Sistem                         | `ADM`   | Dashboard lintas bidang, pengelolaan akun dan hak akses, validasi data operasional, penerapan izin penelitian, serta audit. |
| Bidang Pencegahan dan Kesiapsiagaan  | `PK`    | Data risiko dan wilayah rawan, mitigasi, edukasi dan simulasi, serta kajian risiko.                                         |
| Bidang Kedaruratan dan Logistik      | `KL`    | Kejadian bencana, korban dan pengungsi, kebutuhan darurat, logistik, serta distribusi bantuan.                              |
| Bidang Rehabilitasi dan Rekonstruksi | `RR`    | Kerusakan pascabencana, kegiatan pemulihan, progres rehabilitasi, serta dokumentasi.                                        |
| Sekretariat                          | `SEK`   | Administrasi pendukung, arsip, template laporan, dan koordinasi administrasi penelitian.                                    |
| Peneliti / Akademisi                 | `PEN`   | Permohonan penelitian, akses data sesuai izin, serta pengiriman hasil dan revisi penelitian.                                |

## Gambaran alur kerja

**Pencatatan dan kegiatan bidang:** petugas login, memilih kelompok data, mengisi form, lalu menyimpan draf atau mengajukan data. Admin inti memeriksa pengajuan dan memberikan keputusan. Petugas dapat memperbaiki data yang dikembalikan. Dashboard menghitung data berstatus **Disetujui** sesuai bidang dan filter yang dipilih.

**Layanan penelitian:** peneliti mendaftar dan menunggu persetujuan akun, lalu mengajukan permohonan akses data. Sekretariat mengoordinasikan administrasi dan tenggat; Admin memutuskan cakupan permohonan dan mengaktifkan izin. Peninjau bidang memeriksa substansi hasil penelitian. Peneliti mengakses data sesuai izin dan menyerahkan hasil penelitian untuk diperiksa atau direvisi.

**Pelaporan:** pengguna memilih data dan filter, membuat pratinjau laporan, lalu mengunduh Word atau PDF. Arsip laporan menyimpan salinan data, filter, dan versi template pada saat laporan dibuat.

## Menjalankan di Windows

Prasyarat: Node.js 24, npm, dan PostgreSQL yang aktif (integrasi lokal diperiksa menggunakan PostgreSQL 18). Buka terminal pada folder `bpbd-web`.

Sebelum memasang ulang dependensi, hentikan semua server lokal proyek ini dengan **Ctrl+C** di terminal yang menjalankannya. Pada Windows, server yang masih aktif dapat mengunci berkas di `node_modules`, menyebabkan `npm.cmd ci` gagal dengan `EPERM` dan meninggalkan instalasi tidak lengkap.

```powershell
npm.cmd ci
```

Jika belum tersedia, salin `.env.example` menjadi `.env.local`, lalu isi koneksi PostgreSQL. Konfigurasi awal menggunakan host `127.0.0.1`, port `5432`, dan database `bpbd_local`. File `.env.local` diabaikan Git.

```powershell
npm.cmd run db:setup
npm.cmd run db:check
npm.cmd run dev
```

`npm.cmd ci` diperlukan untuk pemasangan awal atau pemulihan dependensi. Untuk menjalankan proyek sehari-hari, cukup `npm.cmd run dev`. Jika instalasi gagal, selesaikan error instalasi terlebih dahulu sebelum menyalakan server.

Buka `http://127.0.0.1:5173`. Halaman awal adalah login bersama; role ditentukan otomatis dari akun. Gunakan **Ganti Akun** atau menu akun **Keluar** untuk mencoba aktor lain. Daftar akun juga tersedia pada halaman login.

Sandi awal semua akun dummy: **`BPBDdemo2026!`**.

| Aktor                                | Email dummy                | Status awal          |
| ------------------------------------ | -------------------------- | -------------------- |
| Admin inti / sistem                  | `adm@bpbd.example`       | Aktif                |
| Bidang Pencegahan dan Kesiapsiagaan  | `pk@bpbd.example`        | Aktif                |
| Bidang Kedaruratan dan Logistik      | `kl@bpbd.example`        | Aktif                |
| Bidang Rehabilitasi dan Rekonstruksi | `rr@bpbd.example`        | Aktif                |
| Sekretariat                          | `sek@bpbd.example`       | Aktif                |
| Peneliti — Nadia                    | `nadia@peneliti.example` | Aktif                |
| Peneliti — Arif                     | `arif@peneliti.example`  | Menunggu Persetujuan |

Satu orang memakai satu akun, dengan tepat satu role. Admin dapat membuat akun internal beserta sandi demo. Peneliti yang mendaftar memakai email dan sandi yang diisikan sendiri; akun menunggu persetujuan hanya bisa membuka status, profil, dan bantuan. Akun nonaktif tidak dapat login.

Validasi data operasional sementara dilakukan **Admin inti**. Petugas mengajukan data bidangnya, Admin menyetujui/meminta perbaikan/menolak, lalu petugas memperbaiki dan mengajukan ulang bila diperlukan. Sekretariat membaca data operasional bidangnya sendiri; koordinasi administrasi penelitian tetap tersedia. Izin peninjau bidang berlaku untuk review hasil penelitian.

Keputusan SSO atau kredensial aplikasi masih menunggu pembahasan kantor. Rincian kesepakatan ada di [catatan diskusi](docs/CATATAN-DISKUSI-LOGIN-DAN-VALIDASI.md).

Untuk Linux, gunakan perintah `npm` sebagai pengganti `npm.cmd`. Gunakan Node.js 24 untuk menjalankan script database TypeScript tanpa proses kompilasi terpisah.

## Memindahkan folder proyek ke server

Pemindahan sekarang mencakup **kode aplikasi dan database PostgreSQL**. Menyalin folder proyek saja tidak membawa data yang sudah tersimpan di database.

1. Salin sumber aplikasi, aset, `package.json`, `package-lock.json`, konfigurasi, `scripts/`, `db/`, dan `drizzle/postgresql/`. Pertahankan folder pendukung lain, termasuk `build/` dan `.openai/`, untuk konfigurasi Sites lama.
2. Folder `node_modules/`, `.next/`, `dist/`, `.vinext/`, `.wrangler/`, `.sites-runtime/`, dan keluaran pengujian tidak perlu disalin. Dependensi dan build dibuat ulang di tujuan. Tanpa profil lokal, script memakai profil `portable` yang menjalankan Next.js pada Node.js.
3. Buat backup PostgreSQL menggunakan `pg_dump`, lalu pulihkan dengan `pg_restore` ke database kosong di server tujuan. Contoh perintah tersedia di [panduan PostgreSQL](docs/POSTGRESQL-LOKAL.md#backup-dan-pemindahan-server). Berkas Word/PDF ikut dalam backup karena disimpan di database.
4. Isi `.env.local` untuk koneksi database di server tujuan. Sesuaikan host, port, user, password, dan nama database.
5. Pasang dependensi, terapkan migrasi yang belum dijalankan, buat build, lalu jalankan aplikasi:

```bash
npm ci --include=dev --include=optional
npm run db:setup
npm run build
npm start
```

Pada Windows gunakan `npm.cmd`. `db:setup` mempertahankan data yang sudah ada dan tidak mengulang seed jika database sudah diinisialisasi.

`npm start` menjalankan Next.js pada `http://127.0.0.1:5173`. Akses domain memerlukan reverse proxy, HTTPS, dan pengelolaan proses sesuai server tujuan. Konfigurasi layanan server tersebut belum disediakan. Script `start:sites` dipertahankan sebagai runtime lama; koneksi PostgreSQL lokal menggunakan runtime Node.js.

## Perintah pemeriksaan proyek

```powershell
npm.cmd run build
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:postgres
```

`npm test` memeriksa aturan domain, hash password, dan validasi akses server. `test:postgres` membutuhkan hasil build, PostgreSQL, serta Microsoft Edge; perintah ini membuat database sementara terpisah, menjalankan tes API dan browser, lalu menghapus database sementara tersebut. Data `bpbd_local` tidak menjadi target pengujian. Konfigurasi browser ada di `playwright.config.ts`.

## Yang dapat dicoba

- Dashboard utama serta empat dashboard bidang, filter seragam, ringkasan, grafik, alternatif tabel, dan rincian catatan.
- Login akun individual untuk enam role, permission peninjau penelitian, pembatasan route, form, validasi, draf, approval, riwayat, arsip, serta penolakan konflik revisi antarpengguna.
- Impor `.xlsx` dan CSV: template, validasi, nomor baris kesalahan, pratinjau, batch atomik di PostgreSQL, pencegahan duplikasi, dan riwayat.
- Pembuatan laporan: salinan data/filter/template yang tetap, unduhan Word `.docx` dan PDF asli, arsip, editor susunan template Sekretariat.
- Pendaftaran akun peneliti baru, keputusan Admin, permohonan, keputusan terpusat Admin, persetujuan sebagian, penerapan izin, batas unduh, masa berlaku dan perpanjangan tenggat.
- Pengiriman hasil Word/PDF ke penyimpanan PostgreSQL, penerimaan, pemeriksaan kelengkapan, review, revisi sebagai versi baru, dan akses dokumen.
- Pengguna, permission, master referensi, pengaturan, audit, profil, bantuan, notifikasi, dan halaman sistem.

Pemetaan 44 tipe halaman ada di [docs/PEMETAAN-HALAMAN.md](docs/PEMETAAN-HALAMAN.md).

Dokumentasi fungsional khusus modul penelitian, termasuk alur pengguna, persetujuan, validasi otomatis, akses data, ekspor CSV, hasil penelitian, dan batasan implementasi, tersedia di [Reverse PRD Penelitian](docs/REVERSE-PRD-PENELITIAN.md).

## Penyimpanan dan batas tahap lokal

Data utama tersimpan di PostgreSQL: tabel akun, kegiatan, penelitian, laporan, impor, audit, pengaturan, sesi, dan dokumen. ID serta relasi utama memiliki kolom tersendiri; rincian form menggunakan JSONB. Dokumen Word/PDF disimpan sebagai bytea. Lihat [rincian tabel dan perilaku penyimpanan](docs/POSTGRESQL-LOKAL.md#penyimpanan-data).

Login diperiksa di backend dengan hash password scrypt dan cookie sesi HttpOnly selama 8 jam. Tab dalam profil browser yang sama berbagi sesi. API membatasi data sesuai akun dan bidang, memvalidasi perubahan, serta menyimpan perubahan dalam transaksi. Jika revisi data sudah berubah, penyimpanan ditolak agar perubahan pengguna lain tidak tertimpa.

Data browser versi lama tidak dihapus dan tidak diimpor otomatis. Untuk memindahkan data lama dari localStorage/IndexedDB, diperlukan proses ekspor/migrasi terpisah. Menghapus data situs di browser sekarang tidak menghapus isi PostgreSQL.

Data awal masih sintetis dengan tanggal acuan skenario 8 Oktober 2026; waktu aksi menggunakan WIB. Layanan email/pemulihan password, SSO, pemindaian keamanan dokumen, dan pengaturan produksi belum tersedia. Arsitektur snapshot bersama ditujukan untuk pengembangan lokal dan perlu ditinjau saat volume data meningkat.

Field, definisi indikator, aturan persetujuan, dan template impor merupakan usulan demo. Template laporan belum resmi; tidak ada tanda tangan pejabat otomatis. Master tambahan disimpan sebagai usulan; pilihan form dan template demo masih mengikuti referensi v1. Pengubahan master yang sudah digunakan ditolak.

Impor awal dibatasi 1.000 baris; `.xls` lama dan formula Excel tidak didukung. Dokumen unggahan menerima `.docx`/PDF. Pemeriksaan dokumen hanya memeriksa format dasar, bukan konten berbahaya. PDF keluaran memakai Helvetica dan transliterasi karakter di luar ASCII; Word mempertahankan Unicode. Tampilan pratinjau dan ekspor memakai snapshot data/teks yang sama, dengan tata letak sederhana untuk draf.

Target LCP/INP/CLS pada PRD belum dinyatakan terpenuhi. Pengujian performa produksi dengan perangkat, jaringan, dan volume data representatif tetap diperlukan. Hasil pengujian lokal belum menyatakan kesiapan layanan produksi.

WebMCP diekspos bila browser mendukungnya: `read_bpbd_demo_summary` dan `navigate_bpbd_demo`. Validasi dalam konteks WebMCP asli belum tersedia di lingkungan ini; browser biasa mengabaikannya dengan aman.

## Struktur kode

- `app/`: metadata, tema, route awal dan catch-all.
- `components/bpbd/`: shell, komponen bersama, dashboard, operasional, penelitian, administrasi, autentikasi demo.
- `components/ui/`: primitive UI bawaan starter; digunakan kembali tanpa diubah.
- `lib/bpbd/model.ts`: model demo, seed, izin dan filter.
- `lib/bpbd/files.ts`: CSV/Excel, Word/PDF, serta unggah/unduh berkas melalui API.
- `lib/bpbd/api.ts`: komunikasi browser dengan backend.
- `lib/server/`: alur data, validasi hak akses, sesi, dan hash password.
- `app/api/bpbd/`: endpoint backend untuk login, pendaftaran, data, dan berkas.
- `scripts/`, `build/`: script instalasi, pemilihan runtime, dan pendukung build/hosting.
- `db/`, `drizzle/postgresql/`: skema, koneksi, dan migrasi PostgreSQL.
- `scripts/setup-db.ts`, `scripts/check-db.ts`: inisialisasi dan pemeriksaan database.
- `public/`: logo dan aset statis.
- `docs/`: pemetaan halaman dan catatan keputusan proyek.
- `tests/`: pengujian domain dan alur browser.
- `.openai/hosting.json`: identitas Site privat; tidak memuat kredensial.

Stack lokal: React 19, TypeScript, Next.js pada Node.js, PostgreSQL, driver pg, Drizzle, Tailwind, primitive Shadcn/Radix, dan Recharts. Konfigurasi Vinext/Vite/Sites lama tetap tersedia; perubahan ini menargetkan penggunaan lokal.

Untuk mulai menelusuri modul, Kelompok 1 dapat melihat `components/bpbd/dashboard.tsx`; Kelompok 2 melihat `components/bpbd/research.tsx` dan alur akun pada `components/bpbd/auth.tsx`; Kelompok 3 melihat `components/bpbd/operations.tsx` serta `components/bpbd/dashboard.tsx`. Model data, izin, dan filter bersama berada di `lib/bpbd/model.ts`.
