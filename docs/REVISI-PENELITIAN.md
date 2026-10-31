# Revisi penelitian

Revisi mengikuti “Notulensi rencana perubahan bagian penelitian”, termasuk dua gambar rincian permohonan. Perubahan hanya menyangkut layanan penelitian dan pendukungnya.

- Nomor telepon/WhatsApp wajib saat pendaftaran peneliti, dapat diubah lewat Profil Saya, dan terlihat pada daftar serta pemeriksaan akun peneliti. Akun lama tidak diberi nomor fiktif; lengkapi profilnya terlebih dahulu.
- Beranda peneliti tidak lagi menampilkan tombol Ajukan Permohonan. Tombol tetap ada di Permohonan Data, nama pengganti Permohonan Saya.
- Show Data berada di atas Permohonan Data. Setiap dataset yang dapat diminta menampilkan lima contoh **sintetis**, tanpa membuka data operasional sebelum mendapat izin.
- Rincian permohonan peneliti hanya menampilkan Rincian dan panel Jadwal & akses. Tab keputusan dan riwayat tetap tersedia bagi petugas peninjau.
- Saat peneliti menekan **Kirim Permohonan**, server otomatis memvalidasi **seluruh baris** data operasional yang sudah disahkan sesuai dataset, wilayah, dan periode permohonan. Sistem menyimpan ID, versi, waktu validasi, dan riwayat. Simpan Draf tidak menjalankan validasi. Tidak ada checkbox validasi per baris.
- Peninjau tetap menentukan keputusan cakupan. Saat cakupan disetujui, server otomatis memperbarui validasi seluruh baris sesuai versi terbaru. Izin diaktifkan setelah keputusan bidang lengkap. Perubahan data setelah persetujuan memerlukan penyimpanan keputusan kembali agar validasi diperbarui otomatis.
- Izin lama tanpa catatan validasi baris dapat diperbarui dengan menyimpan kembali persetujuan cakupan; seluruh baris otomatis divalidasi tanpa mencentang satu per satu. Data dan keputusan lama tidak dihapus.
- Data yang Disetujui dan Rincian Akses Data menampilkan semua dataset yang disetujui, maksimal lima baris per dataset. Tombol **Ekspor CSV** pada kedua halaman mengunduh seluruh baris tervalidasi sesuai cakupan, bukan hanya lima baris pratinjau. Server memeriksa ulang pemilik, izin unduh, masa akses, dan validasi versi data saat ekspor.

## Pengingat WhatsApp

Integrasi disiapkan untuk WhatsApp Business Cloud API. Tidak ada pesan yang dikirim sebelum konfigurasi dan pengiriman diaktifkan oleh pengelola.

1. Siapkan akun pengirim dan template yang disetujui di WhatsApp Business. Template body memakai tiga parameter berurutan: **nama peneliti**, **judul penelitian**, **tanggal tenggat YYYY-MM-DD**. Dokumentasi: [Meta — WhatsApp Cloud API](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api).
2. Isi variabel `WHATSAPP_*` dari `.env.example` di `.env.local`. Token hanya dibaca oleh proses server; jangan menaruhnya di kode frontend. `WHATSAPP_GRAPH_VERSION` mengikuti versi aktif aplikasi Meta Anda, misalnya dalam format `vXX.0`.
3. Jalankan `npm.cmd run db:setup` untuk migrasi tabel riwayat pengiriman. Migrasi mempertahankan data yang sudah ada.
4. Peneliti mengisi nomor aktif dan persetujuan pengingat di Profil Saya. Pendaftaran baru mencakup persetujuan pengingat pada pernyataan kewajiban.
5. Pratinjau tanpa mengirim: `npm.cmd run research:reminders`.
6. Setelah konfigurasi lengkap, satu pemeriksaan dengan pengiriman: `npm.cmd run research:reminders -- --send`.
7. Untuk pemeriksaan otomatis per jam, gunakan `npm.cmd run research:reminders -- --send --watch`. Alternatif Windows: jalankan `powershell -ExecutionPolicy Bypass -File scripts/register-research-reminders.ps1` setelah Node tersedia di PATH. Script mendaftarkan tugas `BPBD-Pengingat-Penelitian`; tugas berjalan saat pengguna login dan komputer menyala, terpisah dari server web. Script tersebut tidak dijalankan otomatis saat instalasi proyek.

Jadwal setiap tujuh hari mulai H-30 adalah **H-30, H-23, H-16, H-9, H-2** berdasarkan tanggal WIB. Jika komputer sempat mati, hanya jadwal minggu berjalan yang diproses, tanpa menumpuk pesan minggu yang sudah lewat. Pengingat berhenti setelah hasil dikirim atau tenggat lewat, serta untuk akun nonaktif, permohonan draf/ditolak, nomor tidak valid, atau peneliti yang tidak menyetujui pengingat. Perpanjangan tenggat membuat jadwal baru.

Riwayat disimpan di `bpbd_research_reminders` dengan kunci unik permohonan+tenggat+minggu. Dua worker tidak dapat mengirim bersamaan. `accepted` berarti diterima API penyedia, bukan bukti diterima penerima; webhook konfirmasi pengantaran belum disediakan. Penolakan HTTP dapat dicoba kembali setelah satu jam. Status `sending` yang tersisa atau `uncertain` tidak dicoba ulang otomatis karena pesan mungkin sudah diterima API. Pengelola harus memeriksa riwayat penyedia sebelum mengubah status menjadi `failed` untuk mengizinkan percobaan ulang.

Untuk menonaktifkan tugas Windows: `Disable-ScheduledTask -TaskName BPBD-Pengingat-Penelitian`.
