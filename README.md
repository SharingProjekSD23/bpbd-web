# Prototipe UI/UX BPBD Kota Semarang

Implementasi berdasarkan PRD UI/UX versi 1.0 dan Sitemap Halaman dan Komponen UI versi 1.0, 8 Oktober 2026. Logo menggunakan aset yang diberikan dalam proyek.

## Menjalankan di Windows

Prasyarat: Node.js 24 dan npm. Buka terminal pada folder `bpbd-web`.

```powershell
npm.cmd ci
npm.cmd run dev
```

Buka `http://127.0.0.1:5173`. Halaman awal menampilkan dashboard demo Admin. Gunakan **Lihat sebagai** untuk meninjau enam role. Menu akun menyediakan Keluar dan halaman login.

Akun login demo: `demo@bpbd.test` / `BPBDdemo2026!`.

```powershell
npm.cmd run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test tests/domain.test.mjs
node node_modules/@playwright/test/cli.js test
```

Tes browser membutuhkan server dev yang berjalan dan Microsoft Edge. Konfigurasi ada di `playwright.config.ts`.

## Yang dapat dicoba

- Dashboard utama serta empat dashboard bidang, filter seragam, ringkasan, grafik, alternatif tabel, dan rincian catatan.
- Navigasi enam role, permission peninjau tambahan, pembatasan route, form, validasi, draf, approval, riwayat, arsip, serta konflik versi lintas tab.
- Impor `.xlsx` dan CSV: template, validasi, nomor baris kesalahan, pratinjau, batch atomik di penyimpanan lokal, pencegahan duplikasi, dan riwayat.
- Pembuatan laporan: salinan data/filter/template yang tetap, unduhan Word `.docx` dan PDF asli, arsip, editor susunan template Sekretariat.
- Pendaftaran akun peneliti baru, keputusan Admin, permohonan, keputusan per bidang, persetujuan sebagian, penerapan izin, batas unduh, masa berlaku dan perpanjangan tenggat.
- Pengiriman hasil Word/PDF ke IndexedDB, penerimaan, pemeriksaan kelengkapan, review, revisi sebagai versi baru, dan akses dokumen.
- Pengguna, permission, master referensi, pengaturan, audit, profil, bantuan, notifikasi, dan halaman sistem.

Pemetaan 44 tipe halaman ada di [docs/PEMETAAN-HALAMAN.md](docs/PEMETAAN-HALAMAN.md).

## Batas prototipe dan integrasi berikutnya

Ini adalah frontend untuk meninjau UI dan alur. Autentikasi dan RBAC disimulasikan; kode/data demo di browser bukan pengamanan server. Belum ada API/database operasional, penyimpanan bersama, layanan email, atau pemindaian keamanan dokumen. Jangan memasukkan data BPBD sebenarnya.

Data terstruktur disimpan dengan kunci `bpbd-demo-v1` di localStorage; berkas tersimpan di database IndexedDB `bpbd-demo-files`. Data hanya tersedia pada browser/origin yang sama. Tanggal acuan skenario adalah 8 Oktober 2026; waktu aksi memakai WIB. Seluruh data bersifat sintetis. Untuk mengulang dari awal, hapus data situs pada pengaturan browser.

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
