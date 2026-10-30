-- ============================================================================
-- SIAGA - BPBD Kota Semarang | Modul Penelitian (Kelompok 2)
-- PostgreSQL | 27 Oktober 2026
-- ============================================================================
-- File ini berisi struktur modul penelitian sesuai implementasi aplikasi saat
-- ini, dengan dua tabel bersama yang diperlukan untuk akun dan dokumen.
--
-- CARA MENGGUNAKAN
-- 1. Buat database kosong melalui pgAdmin, misalnya bpbd_penelitian.
-- 2. Buka Query Tool pada database tersebut, buka file ini, lalu Execute.
--    Alternatif terminal:
--    psql -h 127.0.0.1 -p 5432 -U postgres -d bpbd_penelitian \
--      -v ON_ERROR_STOP=1 -f penelitian.sql
-- 3. Tabel akan tersedia pada schema public.
--
-- File dijalankan pada database kosong dan tidak memuat DROP, TRUNCATE,
-- kredensial koneksi, akun pengguna, atau salinan data dari database lokal.
-- Jika nama tabel sudah ada, transaksi akan gagal tanpa menimpa tabel tersebut.
--
-- Menjalankan aplikasi SIAGA lengkap tetap memerlukan seluruh migrasi proyek,
-- termasuk tabel metadata, sesi, audit, dan data operasional. File ini dapat
-- dipakai untuk mempelajari atau mengembangkan bagian penelitian secara terpisah.
--
-- RELASI
-- public.bpbd_users.id  1 ---- N  public.bpbd_research.owner_id
-- public.bpbd_users.id  1 ---- N  public.bpbd_files.owner_id
--
-- Rujukan dokumen pada data.supportingId dan data.versions[].fileId mengarah ke
-- bpbd_files.id. Rujukan yang berada di JSONB diperiksa backend, bukan FK SQL.
-- ============================================================================

BEGIN;

-- 1. AKUN: tabel bersama untuk identitas peneliti dan petugas terkait.
-- Tidak ada akun maupun password contoh yang dibuat oleh file ini.
CREATE TABLE public.bpbd_users (
    id            text  PRIMARY KEY NOT NULL,
    email         text  NOT NULL,
    role          text  NOT NULL,
    password_hash text  NOT NULL,
    data          jsonb NOT NULL
);

CREATE UNIQUE INDEX bpbd_users_email_unique
    ON public.bpbd_users (email);

COMMENT ON TABLE public.bpbd_users IS
    'Tabel akun bersama. Modul penelitian menggunakan akun peneliti, Admin, Sekretariat, dan peninjau bidang.';
COMMENT ON COLUMN public.bpbd_users.id IS
    'ID akun aplikasi. Nilai ini digunakan sebagai owner_id pada permohonan dan berkas.';
COMMENT ON COLUMN public.bpbd_users.email IS
    'Email unik; backend menyimpan email dalam huruf kecil setelah menghapus spasi di awal dan akhir.';
COMMENT ON COLUMN public.bpbd_users.role IS
    'Kode role: PEN (peneliti), ADM (Admin), SEK (Sekretariat), PK/KL/RR (bidang). Kewenangan peninjau ditentukan backend.';
COMMENT ON COLUMN public.bpbd_users.password_hash IS
    'Hash password yang dibuat backend dengan format scrypt:salt:hash. Simpan hash, bukan password asli.';
COMMENT ON COLUMN public.bpbd_users.data IS
    'Objek JSONB identitas akun: id, name, email, role, institution, status, note, demoPassword. Pada penyimpanan server, demoPassword berisi string kosong.';

-- 2. DOKUMEN: tabel bersama untuk dokumen pendukung dan hasil penelitian.
-- Isi berkas berada di PostgreSQL, sehingga ikut ketika database di-backup.
CREATE TABLE public.bpbd_files (
    id         text                     PRIMARY KEY NOT NULL,
    owner_id   text                     NOT NULL,
    name       text                     NOT NULL,
    mime       text                     NOT NULL,
    content    bytea                    NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT bpbd_files_owner_id_bpbd_users_id_fk
        FOREIGN KEY (owner_id)
        REFERENCES public.bpbd_users (id)
        ON UPDATE NO ACTION ON DELETE NO ACTION
);

COMMENT ON TABLE public.bpbd_files IS
    'Penyimpanan berkas bersama. Pada modul penelitian dipakai untuk dokumen pendukung permohonan dan setiap versi hasil penelitian.';
COMMENT ON COLUMN public.bpbd_files.owner_id IS
    'ID akun pengunggah. Hak membaca dan mengaitkan berkas ke permohonan diperiksa backend.';
COMMENT ON COLUMN public.bpbd_files.name IS
    'Nama asli berkas, misalnya hasil-penelitian.pdf atau surat-pengantar.docx.';
COMMENT ON COLUMN public.bpbd_files.mime IS
    'Jenis berkas: application/pdf atau application/vnd.openxmlformats-officedocument.wordprocessingml.document.';
COMMENT ON COLUMN public.bpbd_files.content IS
    'Isi berkas dalam bentuk biner bytea. Batas ukuran dan validasi dokumen diperiksa backend.';

-- 3. PENELITIAN: tabel utama modul Kelompok 2.
-- Rincian proses disimpan dalam JSONB agar sesuai model dan form yang sudah ada.
CREATE TABLE public.bpbd_research (
    id       text  PRIMARY KEY NOT NULL,
    owner_id text  NOT NULL,
    data     jsonb NOT NULL,
    CONSTRAINT bpbd_research_owner_id_bpbd_users_id_fk
        FOREIGN KEY (owner_id)
        REFERENCES public.bpbd_users (id)
        ON UPDATE NO ACTION ON DELETE NO ACTION
);

COMMENT ON TABLE public.bpbd_research IS
    'Permohonan penelitian beserta keputusan bidang, izin akses data, perpanjangan tenggat, riwayat, dan versi hasil penelitian.';
COMMENT ON COLUMN public.bpbd_research.id IS
    'ID permohonan, misalnya RSET-001. Backend menjaga agar sama dengan data.id.';
COMMENT ON COLUMN public.bpbd_research.owner_id IS
    'ID akun peneliti pemilik permohonan. Backend menjaga agar sama dengan data.owner.';
COMMENT ON COLUMN public.bpbd_research.data IS
    'Objek Research dalam JSONB. Kamus field dan contoh bentuknya tercantum di file penelitian.sql.';

COMMIT;

-- ============================================================================
-- KAMUS FIELD public.bpbd_research.data
-- ============================================================================
-- Field               Jenis JSON       Keterangan
-- id                  string           ID permohonan; sama dengan kolom id.
-- owner               string           ID peneliti; sama dengan kolom owner_id.
-- title               string           Judul penelitian.
-- institution         string           Institusi peneliti saat mengajukan.
-- purpose             string           Tujuan penelitian/penggunaan data.
-- requestedGroups     array string     Kode kelompok data yang diminta.
-- area                string           Kecamatan; "all" berarti semua kecamatan.
-- start               string tanggal   Awal periode data, format YYYY-MM-DD.
-- end                 string tanggal   Akhir periode data, format YYYY-MM-DD.
-- deadline            string tanggal   Tenggat penyerahan hasil penelitian.
-- status              string           Status permohonan, terpisah dari izin.
-- access              string           Status izin akses data.
-- accessEnd           string tanggal   Tanggal akhir masa akses data.
-- download            boolean          Hak unduh data yang diberikan.
-- decisions           object           Keputusan per bidang, berkunci PK/KL/RR.
-- history             array object     Riwayat aksi dalam proses permohonan.
-- versions            array object     Hasil penelitian beserta setiap revisi.
-- extension           object opsional  Usulan perpanjangan: date dan reason.
-- supportingId        string opsional  ID dokumen pendukung di bpbd_files.
-- supportingName      string opsional  Nama dokumen pendukung.
-- complete            boolean opsional Kelengkapan hasil sudah diperiksa.
--
-- decisions.<kode_bidang>:
--   status    : Disetujui | Ditolak | Perlu Perbaikan
--   note      : catatan keputusan
--   groups    : array kode kelompok data yang disetujui
--   download  : boolean opsional, persetujuan hak unduh oleh bidang
--   accessEnd : tanggal opsional, batas masa akses dari bidang
--
-- history[]:
--   at        : waktu aksi ISO 8601
--   actor     : nama pelaku aksi
--   action    : uraian tindakan
--   note      : catatan opsional
--
-- versions[]:
--   id        : ID versi hasil penelitian
--   at        : waktu pengiriman ISO 8601
--   filename  : nama berkas Word/PDF
--   fileId    : ID berkas pada bpbd_files
--   summary   : ringkasan hasil
--   feedback  : rekomendasi untuk BPBD
--   review    : status peninjauan substansi
--   note      : catatan peninjau
--
-- STATUS YANG DIGUNAKAN APLIKASI
-- Akun peneliti:
--   Menunggu Persetujuan, Perlu Perbaikan, Ditolak, Aktif, Nonaktif.
-- Permohonan:
--   Draf, Diajukan, Dalam Peninjauan, Perlu Perbaikan,
--   Disetujui, Disetujui Sebagian, Ditolak.
-- Izin akses:
--   Belum Aktif, Aktif, Dicabut, Berakhir.
--   Aplikasi juga memeriksa accessEnd saat menentukan apakah izin masih berlaku.
-- Review hasil:
--   Belum Ditinjau, Sedang Ditinjau, Perlu Perbaikan, Selesai Ditinjau.
-- Penerimaan hasil ditentukan dari keberadaan versions, terpisah dari review.
--
-- KELOMPOK DATA YANG DAPAT DIMINTA
-- PK  : risiko, mitigasi, edukasi, kajian.
-- KL  : kejadian, korban, kebutuhan, logistik, distribusi.
-- RR  : kerusakan, pemulihan, progres, dokumentasi.
-- SEK : administrasi, arsip.
-- Kode di atas mengikuti model data bersama. Persetujuan, cakupan data, dan
-- siapa yang boleh meninjau setiap bidang tetap mengikuti aturan backend.
--
-- Persetujuan akun, persetujuan permohonan, dan aktivasi izin adalah proses
-- terpisah. File DDL ini tidak memberikan hak akses data atau membuat sesi login.
-- FK SQL memeriksa keberadaan akun; role PEN, isi JSONB, kesesuaian id/owner,
-- rujukan dokumen, dan transisi status tetap divalidasi oleh backend aplikasi.

-- ============================================================================
-- CONTOH BENTUK JSONB (ilustrasi saja; tidak dimasukkan sebagai data)
-- ============================================================================
/*
{
  "id": "RSET-CONTOH",
  "owner": "PEN-CONTOH",
  "title": "Kajian kesiapsiagaan banjir",
  "institution": "Universitas Contoh",
  "purpose": "Mempelajari data agregat untuk penelitian.",
  "requestedGroups": ["kejadian", "mitigasi"],
  "area": "Genuk",
  "start": "2026-01-01",
  "end": "2026-10-08",
  "deadline": "2026-12-15",
  "status": "Diajukan",
  "access": "Belum Aktif",
  "accessEnd": "2026-12-15",
  "download": false,
  "decisions": {},
  "history": [
    {
      "at": "2026-10-27T09:00:00+07:00",
      "actor": "Peneliti Contoh",
      "action": "Permohonan diajukan"
    }
  ],
  "versions": []
}
*/

-- ============================================================================
-- CONTOH QUERY BACA (jalankan setelah akun dan permohonan diisi melalui backend)
-- ============================================================================
/*
-- Daftar permohonan dengan nama peneliti.
SELECT
    r.id,
    u.data ->> 'name' AS nama_peneliti,
    r.data ->> 'title' AS judul_penelitian,
    r.data ->> 'institution' AS institusi,
    r.data ->> 'status' AS status_permohonan,
    r.data ->> 'access' AS status_izin,
    r.data ->> 'deadline' AS tenggat_hasil
FROM public.bpbd_research AS r
JOIN public.bpbd_users AS u ON u.id = r.owner_id
ORDER BY r.id;

-- Keputusan tiap bidang atas satu permohonan.
SELECT
    d.key AS kode_bidang,
    d.value ->> 'status' AS keputusan,
    d.value ->> 'note' AS catatan,
    d.value -> 'groups' AS kelompok_disetujui
FROM public.bpbd_research AS r
CROSS JOIN LATERAL jsonb_each(r.data -> 'decisions') AS d
WHERE r.id = 'RSET-CONTOH';

-- Semua versi hasil dan dokumennya untuk satu permohonan.
SELECT
    v.value ->> 'id' AS id_versi,
    v.value ->> 'at' AS waktu_kirim,
    v.value ->> 'review' AS status_review,
    v.value ->> 'summary' AS ringkasan,
    f.id AS id_berkas,
    f.name AS nama_berkas,
    f.mime AS jenis_berkas
FROM public.bpbd_research AS r
CROSS JOIN LATERAL jsonb_array_elements(r.data -> 'versions') AS v
LEFT JOIN public.bpbd_files AS f ON f.id = v.value ->> 'fileId'
WHERE r.id = 'RSET-CONTOH';
*/
