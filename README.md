# SIAGA — Sistem Data Kebencanaan BPBD Kota Semarang

Aplikasi gabungan Kelompok 1, 2, dan 3 dengan satu login akun individual dan PostgreSQL lokal. Kelompok 2 (`bpbd-web`) menjadi aplikasi utama; modul penelitian dipertahankan, dashboard/logistik Kelompok 1 diadaptasi, dan antarmuka serta alur operasional Kelompok 3 diintegrasikan.

**Panduan hasil penggabungan:** [Integrasi Kelompok 1–3](docs/INTEGRASI-KELOMPOK.md), termasuk hak akses, migrasi data, cadangan, pemulihan, dan batas lingkup penelitian.

## Alur dan hak akses

- Petugas mengisi, mengimpor, memperbarui, dan mengekspor catatan bidang melalui **Operasional Bidang**. Data langsung tersimpan tanpa persetujuan Admin. Riwayat revisi dan lampiran tetap tersedia.
- PK/KL/RR mengelola bidang sendiri. SEK membaca bidang lain dan hanya mengubah bidang SEK. Logistik bersama dapat dilihat secara rinci oleh seluruh bidang internal; input hanya KL. Data kejadian privat tidak terbuka melalui menu logistik.
- **Dashboard Logistik** menampilkan persediaan, transaksi, grafik, kategori, data asal, dan dokumen sumber sesuai izin.
- Seluruh verifikasi penelitian dilakukan **Admin**: akun, permohonan, izin akses, tenggat/perpanjangan, kelengkapan, dan review hasil. PEN mengelola pengajuan/hasil sendiri serta menggunakan data yang diizinkan.
- Dataset penelitian K2 sebelumnya dipertahankan. Penambahan data operasional baru ke katalog penelitian dan hubungan revisinya menunggu keputusan tim BPBD; tidak dibuka otomatis.

## Menjalankan di Windows

Prasyarat: Node.js 24, npm, PostgreSQL aktif. Aplikasi tidak memerlukan server Java atau Supabase saat dijalankan.

```powershell
npm.cmd ci
npm.cmd run db:setup
npm.cmd run dev
```

Jalankan dari folder `Github/bpbd-web`. Untuk pemasangan pertama, salin `.env.example` menjadi `.env.local` dan isi koneksi PostgreSQL. Pada mesin integrasi ini `.env.local` memakai **bpbd_local_integrasi**; database **bpbd_local** sebelum integrasi tetap disimpan. Jangan menimpa `.env.local` yang sudah berisi konfigurasi.

`npm.cmd ci` diperlukan saat pemasangan/perubahan dependensi dan dijalankan ketika server proyek berhenti. Pemakaian harian cukup `npm.cmd run dev`. Buka **http://127.0.0.1:5173**. Untuk Linux gunakan `npm` menggantikan `npm.cmd`.

Build produksi: `npm.cmd run build`, lalu `npm.cmd start`. Kode dan database harus dipindahkan bersama; menyalin folder proyek saja tidak memindahkan data. Panduan ada di [PostgreSQL lokal](docs/POSTGRESQL-LOKAL.md) dan [dokumen integrasi](docs/INTEGRASI-KELOMPOK.md).

## Akun awal

Akun yang telah ada tetap menggunakan kredensial sebelumnya. Pada seed pengembangan, sandi akun dummy adalah `BPBDdemo2026!`; role mengikuti akun yang login.

| Aktor                                | Email dummy                | Status awal          |
| ------------------------------------ | -------------------------- | -------------------- |
| Admin inti / sistem                  | `adm@bpbd.example`       | Aktif                |
| Bidang Pencegahan dan Kesiapsiagaan  | `pk@bpbd.example`        | Aktif                |
| Bidang Kedaruratan dan Logistik      | `kl@bpbd.example`        | Aktif                |
| Bidang Rehabilitasi dan Rekonstruksi | `rr@bpbd.example`        | Aktif                |
| Sekretariat                          | `sek@bpbd.example`       | Aktif                |
| Peneliti — Nadia                    | `nadia@peneliti.example` | Aktif                |
| Peneliti — Arif                     | `arif@peneliti.example`  | Menunggu Persetujuan |

## Pemeriksaan

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:postgres
```

Tes database membuat database sementara terpisah dan menghapusnya setelah selesai. `test:postgres` membutuhkan hasil build dan Microsoft Edge, serta memeriksa alur browser termasuk penelitian dan operasional. Data pengguna tidak menjadi target tes.

## Penyimpanan dan struktur

- `components/bpbd/integrated.tsx`: dashboard logistik dan ruang kerja terintegrasi.
- `integration/kelompok3/`: antarmuka asli K3 yang disesuaikan; aset dilayani melalui sesi login.
- `lib/operations/`, `app/api/operasional/`: pencatatan, izin bidang, stok, impor/ekspor, revisi, dan lampiran.
- `components/bpbd/research.tsx`, `lib/server/policy.ts`: alur penelitian dan keputusan Admin.
- `lib/server/`, `app/api/bpbd/`: login, akun, penelitian, izin data, dan dokumen K2.
- `db/`, `drizzle/postgresql/`, `sql/integrasi.sql`: koneksi, skema, dan migrasi PostgreSQL.
- `scripts/`: setup, ekspor sumber, ekstraksi pratinjau, migrasi, dan pemeriksaan.
- `tests/`: aturan domain, integrasi database, dan alur browser.

Data utama dan berkas disimpan di PostgreSQL. Kata sandi memakai hash scrypt dan sesi cookie HttpOnly. ID/relasi sumber, data mentah, dan checksum berkas dipertahankan. Backup serta kredensial tidak masuk Git. Impor CSV/XLSX operasional maksimal 5.000 baris/15 MB; lampiran PDF/JPG/PNG maksimal 10 MB. Dokumen penelitian tetap mengikuti validasi K2.

Data awal gabungan mencakup 2.426 catatan operasional dari sumber K1 dan pratinjau K3 yang disetujui pengguna. Konflik sumber, pemetaan saldo logistik, dan arsip permintaan K1 dijelaskan dalam dokumen integrasi. Informasi lama dalam dokumen PRD/prototipe merupakan konteks historis; aturan akses terbaru mengacu pada dokumen integrasi.

Stack: React 19, TypeScript, Next.js/Node.js, PostgreSQL, pg, Drizzle, Tailwind, Shadcn/Radix, Recharts, dan ExcelJS. Konfigurasi Vinext/Vite/Sites lama tetap tersedia, tetapi integrasi ini menggunakan runtime Node.js lokal. Pemulihan password/email, SSO, pemindaian malware, dan pengelolaan server produksi belum disediakan.

## Data demo operasional lokal

Untuk database operasional kosong, jalankan `npm.cmd run db:seed-demo`.
Script menambahkan 31 catatan simulasi berlabel DEMO: barang, transaksi tiga bulan,
stok opname, dan kegiatan tiap bidang. Angka stok awal mengacu pada dokumentasi
integrasi K1 (240 pcs, 38 dus, 71 paket); nama barang, tanggal, transaksi, batas
minimum, dan kegiatan adalah simulasi, bukan pemulihan riwayat asli. Transaksi
simulasi menghasilkan saldo 250 pcs, 48 dus, dan 81 paket serta satu peringatan stok.
Script menolak database yang sudah memiliki catatan operasional di luar dataset
demo ini dan tidak menimpa catatan yang ada. Pengulangan tidak menggandakan data.
Akun, penelitian, serta izin akses tetap memakai konfigurasi yang sudah ada.
