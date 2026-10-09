# Pemetaan sitemap ke prototipe

Acuan: `Sitemap_Halaman_Komponen_UI_BPBD.docx`, 8 Oktober 2026. Terdapat 44 tipe halaman. Route detail/form memakai data dan pola bersama.

| Kode | Route | Implementasi |
|---|---|---|
| A01 | `/masuk` | Login individual dummy; role otomatis dari akun |
| A02 | `/daftar-peneliti` | Pendaftaran akun baru; persetujuan kewajiban |
| A03 | `/pemulihan-akun` | Permintaan pemulihan demo; email belum terhubung |
| S01 | `/profil` | Profil akun aktif |
| S02 | `/bantuan` | Panduan role dan alur |
| S03 | `/status-akun` | Status dan catatan pendaftaran |
| S04 | `/403` | Akses ditolak |
| S05 | `/404` atau route tak dikenal | Halaman tidak ditemukan |
| S06 | `/gangguan` | Keadaan layanan gagal |
| D01 | `/dashboard` | Ringkasan utama sesuai cakupan |
| D02 | `/dashboard/:bidang` | Bidang Pencegahan dan Kesiapsiagaan (`pencegahan`), Bidang Kedaruratan dan Logistik (`kedaruratan`), Bidang Rehabilitasi dan Rekonstruksi (`rehabilitasi`), Sekretariat (`sekretariat`) |
| G01 | `/data/:jenis` | Daftar, filter, pencarian, paginasi |
| G02 | `/data/:jenis/:id` | Detail, dokumen, riwayat, arsip berizin |
| G03 | `/data/:jenis/baru`, `/data/:jenis/:id/edit` | Form, validasi, ringkasan, guard perubahan, konflik versi |
| I01 | `/impor/:jenis/baru` | Template, unggah, validasi, pratinjau, konfirmasi |
| I02 | `/impor` | Riwayat pekerjaan |
| I03 | `/impor/pekerjaan/:id` | Hasil batch dan jumlah data |
| V01 | `/persetujuan` | Antrean semua bidang; validasi sementara Admin inti |
| V02 | `/persetujuan/:id` | Keputusan Admin inti: setujui, minta perbaikan, tolak dengan catatan |
| L01 | `/laporan` | Daftar/arsip laporan |
| L02 | `/laporan/baru` | Filter, pratinjau, snapshot laporan |
| L03 | `/laporan/:id` | Metadata dan unduh Word/PDF |
| L04 | `/laporan/template` | Editor susunan template versi baru untuk Sekretariat |
| R01 | `/riset/permohonan` | Antrean administrasi dan peninjau bidang |
| R02 | `/riset/permohonan/:id` | Keputusan per bidang, cakupan, masa akses, tenggat |
| R03 | `/riset/hasil` | Pemantauan hasil dan repository yang disaring |
| R04 | `/riset/hasil/:id` | Pemeriksaan kelengkapan, review substansi, versi |
| M01 | `/admin/pengguna` | Daftar pengguna |
| M02 | `/admin/pengguna/baru`, `/admin/pengguna/:id` | Form/detail akun dan ringkasan dampak |
| M03 | `/admin/pendaftaran` | Persetujuan akun melalui dialog review |
| M04 | `/admin/hak-akses` | Peninjau penelitian dan tambahan operasional Admin; validasi data oleh Admin inti |
| M05 | `/admin/master/:jenis` | Referensi wilayah, bencana, satuan |
| M06 | `/admin/pengaturan` | Batas unggahan, pengingat, approval demo |
| M07 | `/admin/akses-riset` | Aktivasi, akhir, pencabutan izin yang disetujui bidang |
| AU01 | `/audit` | Daftar audit dan detail baca saja |
| P01 | `/peneliti` | Beranda dan tindak lanjut pribadi |
| P02 | `/peneliti/permohonan` | Daftar permohonan sendiri |
| P03 | `/peneliti/permohonan/baru`, `/peneliti/permohonan/:id/edit` | Permohonan, dokumen, consent, revisi |
| P04 | `/peneliti/permohonan/:id` | Keputusan, jadwal, riwayat, perpanjangan |
| P05 | `/peneliti/data` | Daftar izin dan masa berlaku |
| P06 | `/peneliti/data/:izin` | Data agregat sesuai cakupan, unduh jika berizin |
| P07 | `/peneliti/hasil` | Penerimaan dan status review hasil |
| P08 | `/peneliti/hasil/kirim/:permohonan` | Kirim hasil/revisi, dokumen dan feedback |
| P09 | `/peneliti/hasil/:id` | Dokumen, catatan review, riwayat versi |

Route tambahan `/data` adalah pemilih kelompok sebelum masuk G01, bukan tipe layar baru. Parameter izin penelitian memakai ID permohonan di model demo.

## Komponen C01?C32

`app.tsx` menyusun C01?C03, C30, dan C32. `shared.tsx` menyediakan C04?C10, C12?C14, C18?C20, C22?C24, dan C27. Semua memakai primitive UI yang tersedia bila cocok. `dashboard.tsx` menyediakan kartu indikator C15 serta grafik/alternatif tabel C16. Tabs C17 memakai primitive bawaan. Operasional dan penelitian menyusun unggahan C11, review C25, cakupan C26, dokumen C28, versi C29, dan indikator pekerjaan C31. C21 berupa Skeleton pada pemuatan ruang kerja.

Komponen reusable memakai konteks role, permission, dan data. Status akun, pengajuan, izin, penerimaan hasil, dan review disimpan terpisah. Pemeriksaan browser adalah perilaku prototipe; kewenangan final wajib ditegakkan ulang di backend.

## Pemeriksaan yang dilakukan

- TypeScript tanpa emit dan build produksi.
- Tes domain: izin Admin, peninjau, peneliti menunggu, owner/cakupan/masa izin, filter, validasi tanggal/angka.
- Tes browser: dashboard/filter, keenam role, desktop/mobile, input/approval/laporan, impor dan duplikasi, unggah hasil/review, identitas pendaftar baru, editor admin, perubahan belum disimpan.
- Struktur DOCX diperiksa sebagai ZIP/XML; PDF diperiksa header dan cross-reference.

Perhitungan performa produksi, keamanan backend, penanganan file di server, transaksi database dan kepatuhan AC setelah integrasi belum diuji.
