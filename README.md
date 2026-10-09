# Prototipe UI/UX BPBD Kota Semarang

Implementasi berdasarkan PRD UI/UX versi 1.0 dan Sitemap Halaman dan Komponen UI versi 1.0, 8 Oktober 2026. Logo menggunakan aset yang diberikan dalam proyek.

## Menjalankan di Windows

Prasyarat: Node.js 24 dan npm. Buka terminal pada folder `bpbd-web`.

Sebelum memasang ulang dependensi, hentikan semua server lokal proyek ini dengan **Ctrl+C** di terminal yang menjalankannya. Pada Windows, server yang masih aktif dapat mengunci berkas di `node_modules`, menyebabkan `npm.cmd ci` gagal dengan `EPERM` dan meninggalkan instalasi tidak lengkap.

```powershell
npm.cmd ci
npm.cmd run dev
```

`npm.cmd ci` diperlukan untuk pemasangan awal atau pemulihan dependensi. Untuk menjalankan proyek sehari-hari, cukup `npm.cmd run dev`. Jika instalasi gagal, selesaikan error instalasi terlebih dahulu sebelum menyalakan server.

Buka `http://127.0.0.1:5173`. Halaman awal adalah login bersama; role ditentukan otomatis dari akun. Gunakan **Ganti Akun** atau menu akun **Keluar** untuk mencoba aktor lain. Daftar akun juga tersedia pada halaman login.

Sandi awal semua akun dummy: **`BPBDdemo2026!`**.

| Aktor | Email dummy | Status awal |
|---|---|---|
| Admin inti / sistem | `adm@bpbd.example` | Aktif |
| Bidang Pencegahan dan Kesiapsiagaan | `pk@bpbd.example` | Aktif |
| Bidang Kedaruratan dan Logistik | `kl@bpbd.example` | Aktif |
| Bidang Rehabilitasi dan Rekonstruksi | `rr@bpbd.example` | Aktif |
| Sekretariat | `sek@bpbd.example` | Aktif |
| Peneliti — Nadia | `nadia@peneliti.example` | Aktif |
| Peneliti — Arif | `arif@peneliti.example` | Menunggu Persetujuan |

Satu orang memakai satu akun, dengan tepat satu role. Admin dapat membuat akun internal beserta sandi demo. Peneliti yang mendaftar memakai email dan sandi yang diisikan sendiri; akun menunggu persetujuan hanya bisa membuka status, profil, dan bantuan. Akun nonaktif tidak dapat login.

Validasi data operasional sementara dilakukan **Admin inti**. Petugas mengajukan data bidangnya, Admin menyetujui/meminta perbaikan/menolak, lalu petugas memperbaiki dan mengajukan ulang bila diperlukan. Sekretariat membaca data operasional bidangnya sendiri; koordinasi administrasi penelitian tetap tersedia. Izin peninjau bidang berlaku untuk layanan penelitian.

Keputusan SSO atau kredensial aplikasi masih menunggu pembahasan kantor. Rincian kesepakatan ada di [catatan diskusi](docs/CATATAN-DISKUSI-LOGIN-DAN-VALIDASI.md).

```powershell
npm.cmd run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/domain.test.mjs
node node_modules/@playwright/test/cli.js test
```

Tes browser membutuhkan server dev yang berjalan dan Microsoft Edge. Konfigurasi ada di `playwright.config.ts`.

## Yang dapat dicoba

- Dashboard utama serta empat dashboard bidang, filter seragam, ringkasan, grafik, alternatif tabel, dan rincian catatan.
- Login akun individual untuk enam role, permission peninjau penelitian, pembatasan route, form, validasi, draf, approval, riwayat, arsip, serta konflik versi lintas tab.
- Impor `.xlsx` dan CSV: template, validasi, nomor baris kesalahan, pratinjau, batch atomik di penyimpanan lokal, pencegahan duplikasi, dan riwayat.
- Pembuatan laporan: salinan data/filter/template yang tetap, unduhan Word `.docx` dan PDF asli, arsip, editor susunan template Sekretariat.
- Pendaftaran akun peneliti baru, keputusan Admin, permohonan, keputusan per bidang, persetujuan sebagian, penerapan izin, batas unduh, masa berlaku dan perpanjangan tenggat.
- Pengiriman hasil Word/PDF ke IndexedDB, penerimaan, pemeriksaan kelengkapan, review, revisi sebagai versi baru, dan akses dokumen.
- Pengguna, permission, master referensi, pengaturan, audit, profil, bantuan, notifikasi, dan halaman sistem.

Pemetaan 44 tipe halaman ada di [docs/PEMETAAN-HALAMAN.md](docs/PEMETAAN-HALAMAN.md).

## Batas prototipe dan integrasi berikutnya

Ini adalah frontend untuk meninjau UI dan alur. Autentikasi dan RBAC disimulasikan; kode/data demo di browser bukan pengamanan server. Belum ada API/database operasional, penyimpanan bersama, layanan email, atau pemindaian keamanan dokumen. Jangan memasukkan data BPBD sebenarnya.

Data terstruktur disimpan dengan kunci `bpbd-demo-v1` di localStorage; berkas tersimpan di database IndexedDB `bpbd-demo-files`. Data hanya tersedia pada browser/origin yang sama. Sesi akun disimpan per tab melalui sessionStorage `bpbd-auth-user`; muat ulang mempertahankan akun sampai logout/tab ditutup. Sesi pilihan role versi lama tidak dipakai kembali. Data lama dimigrasikan dengan menambahkan sandi awal pada akun yang belum memilikinya, tanpa menghapus catatan atau mengubah status akun. Sandi demo dapat dibaca di browser dan bukan mekanisme penyimpanan sandi produksi. Tanggal acuan skenario adalah 8 Oktober 2026; waktu aksi memakai WIB. Seluruh data bersifat sintetis. Untuk mengulang dari awal, hapus data situs pada pengaturan browser.

Field, definisi indikator, aturan persetujuan, dan template impor merupakan usulan demo. Template laporan belum resmi; tidak ada tanda tangan pejabat otomatis. Master tambahan disimpan sebagai usulan; pilihan form dan template demo masih mengikuti referensi v1. Pengubahan master yang sudah digunakan ditolak.

Impor awal dibatasi 1.000 baris; `.xls` lama dan formula Excel tidak didukung. Dokumen unggahan menerima `.docx`/PDF. Pemeriksaan dokumen hanya memeriksa format dasar, bukan konten berbahaya. PDF keluaran memakai Helvetica dan transliterasi karakter di luar ASCII; Word mempertahankan Unicode. Tampilan pratinjau dan ekspor memakai snapshot data/teks yang sama, dengan tata letak sederhana untuk draf.

Target LCP/INP/CLS pada PRD belum dinyatakan terpenuhi. Pengujian performa produksi dengan perangkat, jaringan, dan volume data representatif tetap diperlukan. Tidak ada integrasi backend yang dianggap lulus melalui tes demo ini.

WebMCP diekspos bila browser mendukungnya: `read_bpbd_demo_summary` dan `navigate_bpbd_demo`. Validasi dalam konteks WebMCP asli belum tersedia di lingkungan ini; browser biasa mengabaikannya dengan aman.

## Struktur kode

- `app/`: metadata, tema, route awal dan catch-all.
- `components/bpbd/`: shell, komponen bersama, dashboard, operasional, penelitian, administrasi, autentikasi demo.
- `components/ui/`: primitive UI bawaan starter; digunakan kembali tanpa diubah.
- `lib/bpbd/model.ts`: model demo, seed, izin dan filter.
- `lib/bpbd/files.ts`: CSV/Excel, Word/PDF, dan penyimpanan berkas.
- `tests/`: pengujian domain dan alur browser.
- `.openai/hosting.json`: identitas Site privat; tidak memuat kredensial.

Stack: React 19, TypeScript, Vinext/Vite, Tailwind, primitive Shadcn/Radix, Recharts. Backend final tetap mengikuti kesepakatan tim proyek.
