# PostgreSQL lokal

Integrasi lokal ditambahkan pada 27 Oktober 2026. Aplikasi menggunakan Next.js pada Node.js untuk melayani tampilan dan API `/api/bpbd/*`. Backend mengakses PostgreSQL melalui driver `pg` dan skema/migrasi Drizzle.

## Konfigurasi dan menjalankan aplikasi

Prasyarat: Node.js 24, npm, dan layanan PostgreSQL yang aktif. Integrasi ini diperiksa menggunakan PostgreSQL 18.

1. Jalankan `npm.cmd ci` di folder proyek.
2. Jika belum ada, salin `.env.example` menjadi `.env.local`.
3. Isi `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, dan `PGDATABASE`. Konfigurasi lokal awal menggunakan `127.0.0.1`, port `5432`, dan database `bpbd_local`.
4. Jalankan `npm.cmd run db:setup`, kemudian `npm.cmd run db:check`.
5. Jalankan `npm.cmd run dev` dan buka `http://127.0.0.1:5173`.

Pada Linux, gunakan `npm` sebagai pengganti `npm.cmd`. `.env.local` diabaikan Git. Password PostgreSQL merupakan kredensial koneksi backend dan berbeda dari password akun login website.

`db:setup` membuat database jika belum tersedia, menerapkan migrasi, dan mengisi data contoh hanya jika metadata awal belum ada. Menjalankannya kembali mempertahankan data yang sudah diinput. Akun yang dipakai saat setup perlu hak membuat database, atau database tujuan perlu disiapkan terlebih dahulu.

Data awal terdiri dari 7 akun, 122 catatan operasional, dan 3 permohonan penelitian. Daftar akun dan password contoh awal ada di README. Password akun website disimpan menggunakan hash scrypt; nilainya tidak dikirim kembali ke browser.

## Penyimpanan data

| Tabel | Isi |
|---|---|
| `bpbd_users` | Identitas akun, email unik, role, status, dan hash password. |
| `bpbd_entries` | Catatan kegiatan/data operasional, kelompok data, status, versi, serta riwayat. |
| `bpbd_research` | Permohonan penelitian, pemilik, keputusan bidang, izin, dan versi hasil penelitian. |
| `bpbd_reports` | Salinan data, filter, dan template ketika laporan dibuat. |
| `bpbd_imports` | Riwayat impor dan fingerprint unik untuk mencegah impor batch berulang. |
| `bpbd_audit` | Jejak tindakan dengan identitas dan waktu dari server. |
| `bpbd_meta` | Pengaturan, master referensi, template, izin tambahan, dan nomor revisi data. |
| `bpbd_sessions` | Hash token sesi login dan masa berlaku. |
| `bpbd_files` | Nama, pemilik, jenis, waktu unggah, dan isi berkas Word/PDF sebagai `bytea`. |

ID, relasi pemilik, email, dan kelompok data memakai kolom tersendiri. Rincian yang mengikuti bentuk prototipe disimpan dalam kolom `data` bertipe JSONB. Struktur ini mempertahankan kompatibilitas form dan snapshot laporan; normalisasi lebih lanjut dapat mengikuti kebutuhan tim database.

Berkas unggahan pada tahap lokal ini juga masuk PostgreSQL, sehingga ikut dalam backup database. Unggahan yang sudah diterima tetapi formnya dibatalkan dapat tersisa tanpa rujukan; pembersihan otomatis berkas tersebut belum disediakan.

## Login, hak akses, dan perubahan bersamaan

Login diverifikasi oleh server. Cookie sesi menggunakan `HttpOnly`, `SameSite=Strict`, dan masa berlaku 8 jam; pada HTTPS cookie juga memakai `Secure`. Browser tidak menerima hash password. Tab dalam profil browser yang sama berbagi cookie login; gunakan profil berbeda atau mode privat untuk mencoba akun secara bersamaan.

API membatasi data sesuai akun dan bidang, memeriksa perubahan form di server, dan mencatat audit. Penyimpanan dijalankan dalam transaksi dengan nomor revisi. Jika pengguna lain lebih dulu menyimpan perubahan, server menolak versi lama dengan status `409`; aplikasi memuat data terbaru agar isian dapat ditinjau sebelum dikirim ulang. Pesan sukses muncul setelah server mengonfirmasi penyimpanan.

Data halaman diperbarui ketika jendela kembali aktif dan setiap 15 detik selama tab terlihat. Pembaruan otomatis ditunda ketika ada form yang belum disimpan atau proses penyimpanan berlangsung. Jika database terputus, aplikasi menampilkan kegagalan dan tidak beralih menyimpan ke browser.

## Data browser dari versi lama

Versi ini tidak lagi memakai `bpbd-demo-v1`, `bpbd-auth-user`, atau IndexedDB `bpbd-demo-files` sebagai penyimpanan aplikasi. Data lama di browser tidak dihapus dan tidak diimpor otomatis. Data yang ingin dipertahankan dari versi lama memerlukan proses ekspor/migrasi terpisah, termasuk berkas unggahannya.

Menghapus data situs pada browser sekarang menghapus sesi browser, tetapi tidak menghapus catatan dalam PostgreSQL. Database baru menggunakan seed dari kode hanya pada inisialisasi pertama.

## Build dan pemeriksaan

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:postgres
```

`test:postgres` menggunakan hasil build, membuat database sementara bernama `bpbd_test_<acak>`, menjalankan pemeriksaan API dan alur browser dengan Microsoft Edge, lalu menghapus database sementara tersebut. Data pada `bpbd_local` tidak menjadi target tes. Akun PostgreSQL pengujian perlu hak membuat dan menghapus database uji. `test:browser` menjalankan rangkaian pengujian terisolasi yang sama.

Untuk menjalankan hasil build lokal:

```powershell
npm.cmd start
```

Alamat default tetap `http://127.0.0.1:5173`. Hentikan server dev sebelum menjalankan `start` pada port yang sama. Script `start:sites` merupakan runtime lama; backend PostgreSQL lokal menggunakan `dev`, `build`, dan `start` pada profil `portable`.

## Backup dan pemindahan server

Menyalin folder kode tidak menyalin isi PostgreSQL. Buat backup database dan simpan terpisah dari kode sumber. Contoh pada Windows dengan instalasi PostgreSQL 18:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -h 127.0.0.1 -p 5432 -U postgres -d bpbd_local -Fc -f '.\bpbd_local.dump'
```

Perintah tersebut meminta password PostgreSQL jika diperlukan. Pada server tujuan, siapkan database kosong dan pulihkan backup:

```bash
createdb -h 127.0.0.1 -p 5432 -U postgres bpbd_local
pg_restore -h 127.0.0.1 -p 5432 -U postgres --no-owner --no-privileges -d bpbd_local bpbd_local.dump
```

Sesuaikan host, user, dan nama database. Gunakan PostgreSQL tujuan yang kompatibel dengan versi backup. Setelah itu, isi `.env.local` pada server tujuan, pasang dependensi, jalankan `db:setup` untuk migrasi yang belum diterapkan, lalu `build` dan `start`. Domain, HTTPS, reverse proxy, serta proses layanan mengikuti konfigurasi server tujuan.

## Batas tahap lokal

Data awal masih sintetis. Aturan bisnis, tanggal acuan demo 8 Oktober 2026, serta format laporan masih mengikuti prototipe. Layanan email/pemulihan password, SSO, pemindaian keamanan dokumen, penjadwalan backup, dan pengujian beban produksi belum termasuk implementasi ini.

Backend saat ini memuat snapshot data dan mengunci revisi bersama ketika menyimpan. Pendekatan ini ditujukan untuk pengembangan lokal; API per entitas, paginasi server, dan optimasi akses database dapat dikembangkan saat volume data dan pengguna meningkat.

Referensi teknis: [koneksi node-postgres](https://node-postgres.com/features/connecting), [Drizzle dan PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql), serta [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
