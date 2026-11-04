# Integrasi Kelompok 1, 2, dan 3

Implementasi lokal, 4 November 2026. Aplikasi utama tetap `Github/bpbd-web` (Kelompok 2), dengan satu login dan PostgreSQL lokal. Folder Kelompok 1 dan Kelompok 3 tetap tersedia sebagai sumber. Branch implementasi: `integrasi/kelompok-1-3`.

## Hasil penggabungan

- Dashboard, persediaan, rincian transaksi, kategori, donor, penerima, dan data asal Kelompok 1 tersedia dalam **Dashboard Logistik** / **Logistik & Data**. Transaksi beberapa barang disimpan sekaligus; kegagalan satu baris membatalkan seluruh transaksi.
- **Operasional Bidang** mempertahankan antarmuka dan alur Kelompok 3: formulir, pratinjau impor, simpan langsung, revisi/riwayat, lampiran, analisis, ekspor, dan cadangan. Server memeriksa tipe data, relasi, revisi bersamaan, dan saldo stok.
- Penelitian Kelompok 2 tetap menggunakan data, akun, pengajuan, dokumen, dan izin yang sudah ada. Semua keputusan penelitian ada pada Admin: akun, permohonan, aktivasi/pencabutan akses, tenggat/perpanjangan, kelengkapan, dan review hasil.
- Operasional tidak memerlukan persetujuan Admin. Status proses seperti progres asesmen BTT tetap merupakan bagian dari pekerjaan bidang.

## Hak akses yang diterapkan

| Role | Operasional bidang | Rincian logistik bersama | Penelitian |
| --- | --- | --- | --- |
| PK | Baca/tulis pencegahan | Baca | Tidak memverifikasi |
| KL | Baca/tulis kejadian, logistik, riwayat sumber | Baca/tulis | Tidak memverifikasi |
| RR | Baca/tulis BTT, alokasi, air, bantuan | Baca | Tidak memverifikasi |
| SEK | Baca seluruh bidang; tulis dokumen/kegiatan SEK | Baca | Baca, tanpa keputusan |
| ADM | Tidak diberikan akses operasional | Tidak diberikan | Seluruh verifikasi dan pengelolaan izin |
| PEN | Tidak diberikan | Tidak diberikan | Pengajuan/hasil sendiri dan dataset yang diizinkan |

Logistik bersama mencakup master barang, masuk, keluar, dan stok opname. **Riwayat logistik sumber K3 mengandung rincian kejadian privat**, sehingga tersedia untuk KL dan SEK. Referensi kejadian pada transaksi bersama disembunyikan dari PK/RR, termasuk riwayat revisi dan ekspor. Pembatasan diperiksa di backend; URL langsung, berkas, cadangan, dan menu lain tidak melewati aturan ini.

## Arsitektur aktual

Runtime cukup Next.js/Node.js dan PostgreSQL; tidak perlu menyalakan dua server Java atau Supabase untuk aplikasi gabungan. Logika server K3 diadaptasi ke TypeScript. Antarmuka asli K3 berada di `integration/kelompok3` dan dimuat melalui route terautentikasi, bukan folder publik. Dashboard K1 diadaptasi ke komponen React dan memakai ledger operasional yang sama.

- `components/bpbd/integrated.tsx`: dashboard logistik, ruang kerja K3, dashboard Admin penelitian.
- `lib/operations/`: definisi modul, izin, validasi, stok, CSV/XLSX, repository, API.
- `app/api/operasional/`: endpoint operasional dengan sesi login K2.
- `lib/server/policy.ts`: seluruh keputusan penelitian dibatasi Admin.
- `db/schema.ts`, `drizzle/postgresql/0002_fat_spacker_dave.sql`, `sql/integrasi.sql`: tabel tambahan dan relasi.

Tabel lama K2 tidak ditimpa. Tabel baru `bpbd_op_*` menyimpan operasional, relasi, lampiran bytea, dan fingerprint impor. `bpbd_source_*` menyimpan data mentah, ID asal, pemetaan ID, relasi asal, dan berkas sumber beserta checksum SHA-256. Jika ID bertabrakan antar sumber, pemetaan menyimpan ID asal dan ID tujuan secara terpisah. Penulisan stok memakai transaksi serta advisory lock PostgreSQL, termasuk pada lebih dari satu proses server.

## Data awal hasil migrasi

Pengguna menyetujui **data pratinjau K3 sebagai data operasional awal**. JSON kerja K3 saat pengambilan sumber kosong. Snapshot `BUKA_PRATINJAU.html` diekstrak sebagai JSON tanpa menjalankan JavaScript-nya.

| Modul | Jumlah gabungan |
| --- | ---: |
| Dokumen/kegiatan SEK | 25 |
| Pencegahan | 11 |
| Kejadian | 866 |
| Master barang | 3 |
| Barang masuk | 16 |
| Barang keluar | 3 |
| Stok opname | 0 |
| BTT | 7 |
| Alokasi air | 2 |
| Distribusi air | 36 |
| Bantuan | 0 |
| Riwayat logistik sumber | 1.457 |
| **Total** | **2.426** |

Asal: 2.400 catatan pratinjau K3 dan 26 catatan operasional K1. Seluruh 33 baris mentah K1 tetap disimpan, termasuk 2 wilayah, 2 asesmen pascabencana, dan 3 permintaan penelitian. Ada 1.456 relasi sumber yang diperiksa (1.431 relasi kejadian K3 dan 25 relasi K1), serta 8 berkas sumber. Folder lampiran operasional awal kosong.

Keputusan pemetaan data:

1. Ledger K1 tidak menunjukkan sumber anggaran pada transaksi keluar. Saldo ditempatkan di sumber **Saldo gabungan K1**, dengan donor asli tetap tersimpan terpisah. Saldo hasil rekonsiliasi: barang ID 1 = 240 pcs, ID 2 = 38 dus, ID 3 = 71 paket. Jumlah berbeda satuan tidak dijumlahkan menjadi satu indikator.
2. Riwayat logistik K3 tidak mengubah stok aktif, mengikuti perilaku asal K3. Menghitung ulang riwayat tersebut sebagai barang masuk/keluar baru berisiko menggandakan persediaan.
3. Asesmen pascabencana K1 tetap tampil sebagai data asal bagi RR/SEK. Data tersebut tidak dipaksa menjadi pengajuan BTT karena prosesnya berbeda.
4. Tiga permintaan data K1 tampil sebagai arsip Admin. `user_id` asal belum dicocokkan dengan akun K2, sehingga tidak dibuatkan identitas atau izin penelitian otomatis.
5. Sumber K3 mencatat delapan ID kejadian dengan perbedaan antarlembar: BNC1069, BNC601, BNC734, BNC735, BNC736, BNC836, BNC859, BNC879. Nilai yang digunakan mengikuti snapshot pratinjau K3; arsip asli dan daftar konflik dipertahankan untuk pemeriksaan bidang. Ini bukan konflik ID yang dibuat oleh migrasi.

Laporan lokal: `backups/migration-report.json` dan `backups/verification-report.json`. Data pribadi, kredensial, ekspor sumber, dan dump database diabaikan Git.

## Menjalankan hasil gabungan

Di folder `Github/bpbd-web`, `.env.local` lokal menggunakan `PGDATABASE=bpbd_local_integrasi`. Database sebelum integrasi `bpbd_local` tetap tersedia.

```powershell
npm.cmd ci
npm.cmd run db:setup
npm.cmd run dev
```

Buka **http://127.0.0.1:5173** dan gunakan akun masing-masing seperti sebelumnya. `npm.cmd ci` hanya untuk pemasangan/pembaruan dependensi, saat server proyek berhenti. Untuk pemakaian harian cukup `npm.cmd run dev`. Build produksi: `npm.cmd run build`, lalu `npm.cmd start`.

## Mengulangi migrasi pada mesin lain

Pulihkan backup PostgreSQL hasil integrasi untuk membawa seluruh data sekaligus. Jika mengulangi dari sumber awal, jalankan urutan berikut dalam salinan kerja dengan `.env.local` yang menunjuk database K2 sebelum integrasi:

```powershell
node --env-file-if-exists=.env.local scripts/prepare-integration-db.mjs
npm.cmd run db:setup
node scripts/export-integration-sources.mjs "C:\path\Github"
node scripts/extract-k3-preview.mjs
npm.cmd run db:migrate-integration
node --env-file-if-exists=.env.local scripts/verify-integration-data.mjs bpbd_local
```

Script persiapan membuat dump, membuat database baru berakhiran `_integrasi`, memulihkan dump, lalu mengganti nama database dalam `.env.local`. Script menolak menimpa database yang sudah ada. Ekspor K1 membutuhkan akses baca ke Supabase sumber; kredensial dibaca dari konfigurasi lokal dan tidak dicetak. Jangan menjalankan ekspor ulang ke direktori sumber yang sudah dipakai migrasi tanpa menyimpan salinannya terlebih dahulu.

Migrasi diulang tanpa duplikasi jika hash sumber sama; perubahan sumber ditolak untuk direkonsiliasi. Tidak ada penghapusan otomatis catatan lama. Setelah pengguna mulai bekerja pada sistem gabungan, jangan menyalin ulang database lama ke database gabungan.

## Cadangan dan pemulihan

Cadangan sebelum integrasi dibuat dan telah dipulihkan ke database integrasi. Simpan berkas `.dump`, `.env.local`, dan folder `backups/sources` secara privat. Untuk cadangan penuh gunakan `pg_dump --format=custom`; pulihkan dengan `pg_restore --no-owner --exit-on-error` ke database kosong, lalu arahkan `.env.local` ke database tersebut dan restart aplikasi.

Tombol cadangan dalam operasional menghasilkan **JSON sesuai cakupan akun**, berisi catatan dan lampiran base64. Format ini menggantikan ZIP lokal K3; pemulihan penuh tetap memakai backup PostgreSQL. Berkas cadangan pengguna bukan pengganti dump seluruh database.

Jika perlu kembali sebelum ada input baru: hentikan aplikasi, simpan `.env.local` integrasi, checkout versi K2 sebelum integrasi (`63ed889`), gunakan kembali konfigurasi `PGDATABASE=bpbd_local`, pasang dependensi yang sesuai, lalu jalankan. Setelah ada input baru, lakukan rekonsiliasi/backup dahulu agar pekerjaan terbaru tidak hilang.

## Batas lingkup yang disepakati

Pemilihan data operasional K1/K3 yang dapat diminta peneliti dan hubungan versi operasional dengan izin penelitian masih menunggu keputusan tim BPBD (poin 6). Dataset penelitian K2 sebelumnya tetap tersedia dengan pembatasan izin/versi yang sudah ada. Data operasional gabungan **tidak otomatis masuk katalog penelitian**.

Impor operasional menerima CSV/XLSX, maksimal 5.000 baris dan 15 MB; formula Excel ditolak. Lampiran operasional menerima PDF/JPG/PNG maksimal 10 MB. Dokumen penelitian tetap mengikuti validasi K2. Belum ada pemindaian malware atau penyiapan layanan produksi.

## Pemeriksaan

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:integration
npm.cmd run build
npm.cmd run test:postgres
```

Tes PostgreSQL membuat database sementara tersendiri. `test:postgres` menggunakan Edge untuk alur login, sesi, pendaftaran, pengajuan penelitian, akses data, hasil penelitian, formulir operasional, impor, dan tampilan seluler. Script `check-integration-browser.mjs` memeriksa tampilan enam role pada server lokal yang ditentukan melalui `BPBD_TEST_URL` (default port 5174).
