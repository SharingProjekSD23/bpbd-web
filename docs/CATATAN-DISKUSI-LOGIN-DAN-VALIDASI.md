# Catatan Diskusi Login, Role, dan Validasi Data

**Tanggal:** 8 Oktober 2026  
**Status:** Kesepakatan login dan arahan sementara diterapkan pada prototipe dummy; aturan sistem nyata belum final.

Catatan ini menyimpan arah pembahasan dengan pengguna. Keputusan yang masih tentatif atau belum dijawab ditandai secara terpisah. PRD UI/UX versi 1.0 tetap menjadi acuan dengan penyesuaian sementara prototipe yang dicatat di bawah.

## Kesepakatan

- Gunakan satu halaman login untuk semua pengguna. Sesudah login, sistem menentukan role dari akun; pengguna tidak memilih role di halaman login.
- Gunakan satu akun per orang dan tepat satu role per akun. Bidang dan izin ditetapkan pada akun sesuai role tersebut.

## Arahan sementara untuk prototipe

- Pengguna selain Admin melihat dashboard, menu, dan data sesuai bidangnya. Akses ke data atau menu bidang lain memerlukan izin.
- Peneliti menggunakan area khusus yang hanya menampilkan permohonan dan cakupan data yang menjadi haknya.
- Bidang terkait tetap menjadi pemilik dan pemasok data operasional.
- **Diterapkan sementara pada demo:** validasi data operasional dari semua bidang ditangani Admin inti (akun role ADM). Menu Persetujuan Data hanya tersedia bagi Admin inti. Data yang memerlukan koreksi dikembalikan ke bidang asal untuk diperbaiki. Tombol Setujui Data, Minta Perbaikan, dan Tolak dipakai untuk menguji alur. Ini belum menetapkan apakah kewenangan Admin inti di sistem nyata mencakup kelengkapan saja atau substansi.

## Revisi yang diterapkan

- **9 Oktober 2026:** nama bidang di tampilan menjadi **Bidang Pencegahan dan Kesiapsiagaan**, termasuk judul dashboard, label role akun, profil, daftar akun dummy, serta pengelolaan pengguna dan hak akses. Status: sudah diterapkan. Kode role `PK`, email `pk@bpbd.example`, dan alamat `/dashboard/pencegahan` tetap digunakan.

## Dibawa untuk dibahas di kantor

- Tentukan apakah akun pegawai memakai akun kerja yang sudah ada (misalnya SSO) atau kredensial yang dikelola aplikasi.

## Pertanyaan yang masih terbuka

1. Apa cakupan validasi Admin inti: pemeriksaan kelengkapan dan format saja, atau persetujuan substansi juga?
2. Apakah semua data baru harus divalidasi, atau hanya jenis data dan tindakan tertentu?
3. Siapa saja petugas Admin inti yang diberi kewenangan validasi sementara, dan kapan peninjau bidang mengambil alih?
4. Apa layanan autentikasi yang dipakai, termasuk cara pemulihan kata sandi dan pengelolaan sesi?

## Konteks prototipe saat ini

- Satu form login email/sandi dipakai semua akun; pilihan role di login dan header dihapus. Role mengikuti akun yang berhasil masuk.
- Halaman awal pengguna tanpa sesi adalah login. Muat ulang mempertahankan sesi akun per tab; Keluar/Ganti Akun menghapus sesi tersebut. Sesi pilihan role lama tidak otomatis menjadi login Admin.
- Dashboard, data operasional, laporan, dan aktivitas petugas dibatasi ke bidangnya, termasuk Sekretariat. Admin dapat membaca lintas bidang; izin mengedit data operasional Admin tetap terpisah dari hak validasi sementara.
- Identitas peneliti mengikuti akun yang login. Peneliti hanya melihat permohonan/hasil miliknya dan data sesuai izin. Akun menunggu persetujuan dibatasi ke status akun, profil, dan bantuan. Akun nonaktif tidak dapat login.
- Pendaftaran peneliti memakai sandi demo yang diisi pendaftar. Akun internal beserta sandi demo dikelola melalui menu Pengguna oleh Admin.
- Alur koordinasi Sekretariat, persetujuan cakupan penelitian oleh bidang, dan penerapan izin oleh Admin tetap mengikuti alur penelitian yang sudah ada. Sentralisasi sementara di atas berlaku untuk validasi data operasional.
- Data contoh lama tetap dipertahankan. Akun lama tanpa sandi diberi sandi demo awal; akun yang sudah memiliki sandi/status hasil perubahan tidak direset.
- Login dan pemeriksaan izin masih simulasi di browser. Autentikasi backend, SSO, layanan pemulihan sandi, dan penyimpanan bersama belum terintegrasi. Gunakan identitas dan sandi contoh.

## Akun dummy untuk uji akses

Sandi awal semua akun berikut: **`BPBDdemo2026!`**. Daftar ini juga tersedia di halaman login dan README. Email, sandi, atau status yang diubah melalui Pengguna berlaku pada browser tempat perubahan disimpan.

| Aktor | Email dummy | Status awal |
|---|---|---|
| Admin inti / sistem | `adm@bpbd.example` | Aktif |
| Bidang Pencegahan dan Kesiapsiagaan | `pk@bpbd.example` | Aktif |
| Kedaruratan dan Logistik | `kl@bpbd.example` | Aktif |
| Rehabilitasi dan Rekonstruksi | `rr@bpbd.example` | Aktif |
| Sekretariat | `sek@bpbd.example` | Aktif |
| Peneliti — Nadia | `nadia@peneliti.example` | Aktif |
| Peneliti — Arif | `arif@peneliti.example` | Menunggu Persetujuan |

Alur uji utama: login sebagai bidang → ajukan data → Ganti Akun ke Admin → buka Persetujuan Data → setujui atau minta perbaikan → login kembali sebagai bidang untuk memeriksa hasil.

## Acuan PRD yang perlu diperhatikan

PRD versi 1.0 menetapkan akun internal dikelola Admin dan peneliti dapat mendaftar. Persetujuan akun peneliti terpisah dari persetujuan cakupan data. Matriks akses membedakan role, izin tindakan, dan cakupan data. Keputusan satu akun satu role memperjelas rancangan akun pada pembahasan ini. PRD juga menyebut peninjau bidang menilai substansi; penunjukan Admin inti sebagai validator data operasional sudah diterapkan sebagai penyesuaian sementara prototipe sesuai arahan diskusi. Cakupan kewenangan dan petugas untuk sistem nyata tetap perlu dikonfirmasi di kantor.
