# Hosting demo: Vercel + Neon

Nama proyek yang diminta: `siaga-bpbd-kota-semarang-demo`.
Alamat yang diinginkan: `https://siaga-bpbd-kota-semarang-demo.vercel.app`.
Ketersediaan nama baru dapat dipastikan setelah proyek dibuat di Vercel.

## Database

Buat database Neon terpisah untuk demo online. Simpan connection string sebagai
`DATABASE_URL` di environment Vercel. Gunakan TLS sesuai connection string Neon.
Jangan gunakan alamat PostgreSQL lokal `127.0.0.1` untuk hosting.

Untuk menginisialisasi database online dari terminal, gunakan file `.env.hosting.local`
yang diabaikan Git, berisi `DATABASE_URL` dari Neon. Jangan menimpa `.env.local`.
Jalankan dari root proyek:

```powershell
node --env-file=.env.hosting.local scripts/setup-db.ts
node --env-file=.env.hosting.local scripts/seed-operations-demo.ts
```

Ini membuat skema, akun seed, serta 31 catatan demo yang sama dengan generator lokal.
Ini bukan penyalinan database lokal: perubahan akun, dokumen, penelitian, dan sesi
lokal tidak ikut dipindahkan. Seed akun awal menggunakan kredensial demo di README.
Setup tidak mengulang seed akun bila database sudah diinisialisasi. Seed operasional
menolak catatan non-demo dan tidak menimpa catatan yang ada.

## Aplikasi

Deploy direktori proyek melalui Vercel CLI atau impor repository GitHub terbaru.
Gunakan preset Next.js, Node.js 24.x, install `npm ci`, build `next build`.
Konfigurasi build tersedia di `vercel.json`. Jangan unggah `.env.local`, backup,
atau kredensial ke GitHub. Bila memakai GitHub, perubahan lokal harus sudah masuk
ke branch yang dideploy.

File `integration/kelompok3/` yang dibaca API disertakan melalui output file tracing.
Database dipersiapkan sekali melalui script di atas, bukan saat setiap build.

## Pemeriksaan setelah deploy

- Login akun PK, KL, RR, SEK, dan Admin.
- Dashboard menampilkan stok, grafik tiga bulan, serta satu peringatan persediaan.
- Logistik & Data bisa dibaca seluruh bidang internal; transaksi hanya KL.
- Operasional Bidang hanya menampilkan bidang pemilik, kecuali SEK yang membaca semua.
- Tambah satu catatan melalui KL dan muat ulang untuk memeriksa penyimpanan online.

Paket gratis Vercel/Neon memiliki kuota. Unggah berkas melalui Vercel Functions juga
tunduk pada batas payload platform, walaupun validasi lokal aplikasi mengizinkan
berkas lebih besar. Uji berkas kecil terlebih dahulu; unggahan besar membutuhkan
penyesuaian penyimpanan/alur upload sebelum dipakai secara operasional.
