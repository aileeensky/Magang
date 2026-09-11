-- SIMONIK - 003_seed.sql
-- Initial master/demo data. This file is separate from schema creation.
-- Safe to run repeatedly where UNIQUE/NOT EXISTS guards are present.

BEGIN;

-- Full UKE I / UKE II structure.
-- Struktur Organisasi SIMONIK (UKE = Unit Kerja/Eselon).


-- =========================================================
-- 1. Pastikan organization_level dapat menyimpan:
--    UKE_I dan UKE_II
--
--    Bagian ini sengaja tidak mengubah tipe kolom secara
--    agresif karena struktur existing DB kamu sudah berjalan.
-- =========================================================


-- =========================================================
-- 2. UKE I
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_I',
    NULL,
    TRUE
FROM (
    VALUES
        ('UKE1-SEKJEN',
         'Sekretariat Jenderal'),

        ('UKE1-DIKMAS',
         'Deputi Bidang Pendidikan dan Peran Serta Masyarakat'),

        ('UKE1-PENCEGAHAN',
         'Deputi Bidang Pencegahan dan Monitoring'),

        ('UKE1-PENINDAKAN',
         'Deputi Bidang Penindakan dan Eksekusi'),

        ('UKE1-INFORMASI',
         'Deputi Bidang Informasi dan Data'),

        ('UKE1-KORSUP',
         'Deputi Bidang Koordinasi dan Supervisi')
) AS v(organization_code, organization_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- =========================================================
-- 3. UKE II - Sekretariat Jenderal
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_II',
    p.organization_id,
    TRUE
FROM (
    VALUES
        ('UKE2-SEKJEN-BIRO-HUKUM',
         'Biro Hukum',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-BIRO-KEUANGAN',
         'Biro Keuangan',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-BIRO-SDM',
         'Biro SDM',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-BIRO-HUMAS',
         'Biro Humas',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-BIRO-UMUM',
         'Biro Umum',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-PPSPK',
         'Pusat Perencanaan Strategis PK',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-INSPEKTORAT',
         'Inspektorat',
         'UKE1-SEKJEN'),

        ('UKE2-SEKJEN-DEWAS',
         'Sekretariat Dewan Pengawas',
         'UKE1-SEKJEN')
) AS v(organization_code, organization_name, parent_code)
JOIN master.organization p
    ON p.organization_code = v.parent_code
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- =========================================================
-- 4. UKE II - Pendidikan dan Peran Serta Masyarakat
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_II',
    p.organization_id,
    TRUE
FROM (
    VALUES
        ('UKE2-DIKMAS-JEJARING',
         'Direktorat Jejaring Pendidikan',
         'UKE1-DIKMAS'),

        ('UKE2-DIKMAS-SOSKAMP',
         'Direktorat Sosialisasi dan Kampanye Antikorupsi',
         'UKE1-DIKMAS'),

        ('UKE2-DIKMAS-BINMAS',
         'Direktorat Pembinaan dan Peran Serta Masyarakat',
         'UKE1-DIKMAS'),

        ('UKE2-DIKMAS-DIKLAT',
         'Direktorat Pendidikan dan Pelatihan Antikorupsi',
         'UKE1-DIKMAS')
) AS v(organization_code, organization_name, parent_code)
JOIN master.organization p
    ON p.organization_code = v.parent_code
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- =========================================================
-- 5. UKE II - Pencegahan dan Monitoring
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_II',
    p.organization_id,
    TRUE
FROM (
    VALUES
        ('UKE2-PENCEGAHAN-PPLHKPN',
         'Direktorat PP LHKPN',
         'UKE1-PENCEGAHAN'),

        ('UKE2-PENCEGAHAN-GRATIFIKASI',
         'Direktorat Gratifikasi dan Pelayanan Publik',
         'UKE1-PENCEGAHAN'),

        ('UKE2-PENCEGAHAN-MONITORING',
         'Direktorat Monitoring',
         'UKE1-PENCEGAHAN'),

        ('UKE2-PENCEGAHAN-AB',
         'Direktorat Antikorupsi Badan Usaha',
         'UKE1-PENCEGAHAN')
) AS v(organization_code, organization_name, parent_code)
JOIN master.organization p
    ON p.organization_code = v.parent_code
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- =========================================================
-- 6. UKE II - Penindakan dan Eksekusi
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_II',
    p.organization_id,
    TRUE
FROM (
    VALUES
        ('UKE2-PENINDAKAN-PENYELIDIKAN',
         'Direktorat Penyelidikan',
         'UKE1-PENINDAKAN'),

        ('UKE2-PENINDAKAN-PENYIDIKAN',
         'Direktorat Penyidikan',
         'UKE1-PENINDAKAN'),

        ('UKE2-PENINDAKAN-PENUNTUTAN',
         'Direktorat Penuntutan',
         'UKE1-PENINDAKAN'),

        ('UKE2-PENINDAKAN-ASET',
         'Direktorat Pelacakan Aset, Pengelolaan Barang Bukti dan Eksekusi',
         'UKE1-PENINDAKAN')
) AS v(organization_code, organization_name, parent_code)
JOIN master.organization p
    ON p.organization_code = v.parent_code
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- =========================================================
-- 7. UKE II - Informasi dan Data
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_II',
    p.organization_id,
    TRUE
FROM (
    VALUES
        ('UKE2-INFORMASI-MANAJEMEN',
         'Direktorat Manajemen Informasi',
         'UKE1-INFORMASI'),

        ('UKE2-INFORMASI-JARINGAN',
         'Direktorat Pembinaan Jaringan Kerjasama Antar Instansi dan Komisi',
         'UKE1-INFORMASI'),

        ('UKE2-INFORMASI-DETEKSI',
         'Direktorat Deteksi dan Analisis Korupsi',
         'UKE1-INFORMASI'),

        ('UKE2-INFORMASI-PELAYANAN',
         'Direktorat Pelayanan Laporan dan Pengaduan Masyarakat',
         'UKE1-INFORMASI')
) AS v(organization_code, organization_name, parent_code)
JOIN master.organization p
    ON p.organization_code = v.parent_code
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- =========================================================
-- 8. UKE II - Koordinasi dan Supervisi
-- =========================================================

INSERT INTO master.organization
    (organization_code, organization_name, organization_level, parent_id, is_active)
SELECT
    v.organization_code,
    v.organization_name,
    'UKE_II',
    p.organization_id,
    TRUE
FROM (
    VALUES
        ('UKE2-KORSUP-WIL-I',
         'Direktorat Koordinasi dan Supervisi Wil I',
         'UKE1-KORSUP'),

        ('UKE2-KORSUP-WIL-II',
         'Direktorat Koordinasi dan Supervisi Wil II',
         'UKE1-KORSUP'),

        ('UKE2-KORSUP-WIL-III',
         'Direktorat Koordinasi dan Supervisi Wil III',
         'UKE1-KORSUP'),

        ('UKE2-KORSUP-WIL-IV',
         'Direktorat Koordinasi dan Supervisi Wil IV',
         'UKE1-KORSUP'),

        ('UKE2-KORSUP-WIL-V',
         'Direktorat Koordinasi dan Supervisi Wil V',
         'UKE1-KORSUP')
) AS v(organization_code, organization_name, parent_code)
JOIN master.organization p
    ON p.organization_code = v.parent_code
WHERE NOT EXISTS (
    SELECT 1
    FROM master.organization o
    WHERE o.organization_code = v.organization_code
);


-- Business processes and risk categories.
INSERT INTO master.business_process(code,name,level)
VALUES
  ('EA-L2-001','Perencanaan dan Pengelolaan Kinerja',2),
  ('EA-L2-002','Manajemen Risiko',2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO master.risk_category(code,name)
VALUES
  ('STRATEGIS','Risiko Strategis'),
  ('OPERASIONAL','Risiko Operasional'),
  ('KEUANGAN','Risiko Keuangan'),
  ('KEPATUHAN','Risiko Kepatuhan'),
  ('FRAUD','Risiko Fraud'),
  ('TI','Risiko Teknologi Informasi')
ON CONFLICT (code) DO NOTHING;

-- Configurable default risk bands.
INSERT INTO master.risk_level_rule(min_score,max_score,level_name,source_note)
SELECT 0,4,'Rendah','Default aplikasi; validasi dengan matriks resmi Perpim No. 1 Tahun 2024'
WHERE NOT EXISTS (SELECT 1 FROM master.risk_level_rule);
INSERT INTO master.risk_level_rule(min_score,max_score,level_name,source_note)
SELECT 5,9,'Sedang','Default aplikasi; validasi dengan matriks resmi Perpim No. 1 Tahun 2024'
WHERE NOT EXISTS (SELECT 1 FROM master.risk_level_rule WHERE level_name='Sedang');
INSERT INTO master.risk_level_rule(min_score,max_score,level_name,source_note)
SELECT 10,14,'Tinggi','Default aplikasi; validasi dengan matriks resmi Perpim No. 1 Tahun 2024'
WHERE NOT EXISTS (SELECT 1 FROM master.risk_level_rule WHERE level_name='Tinggi');
INSERT INTO master.risk_level_rule(min_score,max_score,level_name,source_note)
SELECT 15,999,'Sangat Tinggi','Default aplikasi; validasi dengan matriks resmi Perpim No. 1 Tahun 2024'
WHERE NOT EXISTS (SELECT 1 FROM master.risk_level_rule WHERE level_name='Sangat Tinggi');

-- Roles.
INSERT INTO master.role(role_code,role_name,description) VALUES
('SUPER_ADMIN','Super Admin','Mengelola dan memantau aplikasi SIMONIK.'),
('MANAJER_KINERJA','Manajer Kinerja','Analisis, penyusunan dan pemutakhiran dokumen kinerja unit kerja.'),
('MANAJER_RISIKO','Manajer Risiko','Penilaian, profil, indikator dan perlakuan risiko unit kerja.'),
('PIMPINAN_UNIT','Pimpinan Unit Kerja','Mereviu dan menetapkan dokumen kinerja dan risiko unit kerja serta SKP.'),
('KEPALA_PUSAT_PPSPK','Kepala Pusat Perencanaan Strategis Pemberantasan Korupsi','Mereviu dan menetapkan dokumen tingkat Komisi.'),
('BIDANG_RENSTRA','Bidang Perencanaan Strategis','Menyusun dan mereviu perencanaan strategis dan dokumen kinerja Komisi.'),
('BIDANG_KINERJA_RISIKO','Bidang Pengelolaan Kinerja dan Risiko','Menyusun/reviu LCK, LNKO, profil risiko dan monitoring kinerja/risiko.')
ON CONFLICT(role_code) DO UPDATE SET
  role_name=EXCLUDED.role_name,
  description=EXCLUDED.description;

-- Demo employees/users. Password for local demo accounts: simonik123.
-- Demo users use the real UKE-II organization UKE2-SEKJEN-PPSPK.
INSERT INTO master.employee(organization_id,employee_number,employee_name,position_name,email)
SELECT o.organization_id,v.employee_number,v.employee_name,v.position_name,v.email
FROM master.organization o
CROSS JOIN (VALUES
 ('EMP-0001','Admin SIMONIK','Super Admin','admin@simonik.local'),
 ('EMP-0002','Manajer Kinerja Demo','Manajer Kinerja','kinerja@simonik.local'),
 ('EMP-0003','Manajer Risiko Demo','Manajer Risiko','risiko@simonik.local'),
 ('EMP-0004','Pimpinan Unit Demo','Pimpinan Unit Kerja','pimpinan@simonik.local'),
 ('EMP-0005','Kepala Pusat Demo','Kepala Pusat Perencanaan Strategis Pemberantasan Korupsi','kepala.pusat@simonik.local'),
 ('EMP-0006','Bidang Renstra Demo','Bidang Perencanaan Strategis','renstra@simonik.local'),
 ('EMP-0007','Bidang Kinerja Risiko Demo','Bidang Pengelolaan Kinerja dan Risiko','kinerja.risiko@simonik.local')
) AS v(employee_number,employee_name,position_name,email)
WHERE o.organization_code='UKE2-SEKJEN-PPSPK'
ON CONFLICT(employee_number) DO NOTHING;

INSERT INTO master.app_user(employee_id,username,password_hash)
SELECT e.employee_id,v.username,v.password_hash
FROM master.employee e
JOIN (VALUES
 ('EMP-0001','admin','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92'),
 ('EMP-0002','kinerja','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92'),
 ('EMP-0003','risiko','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92'),
 ('EMP-0004','pimpinan','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92'),
 ('EMP-0005','kepala.pusat','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92'),
 ('EMP-0006','renstra','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92'),
 ('EMP-0007','kinerja.risiko','simonik-demo$f5f3fa3d7e06f1bfe59130126cf0064ba4b17d9488668f0ce3925272224bcb92')
) AS v(employee_number,username,password_hash)
ON v.employee_number=e.employee_number
ON CONFLICT(username) DO NOTHING;

INSERT INTO master.user_role(user_id,role_id,organization_id)
SELECT u.user_id,r.role_id,o.organization_id
FROM master.app_user u
CROSS JOIN master.role r
CROSS JOIN master.organization o
WHERE o.organization_code='UKE2-SEKJEN-PPSPK'
AND (
  (u.username='admin' AND r.role_code='SUPER_ADMIN') OR
  (u.username='kinerja' AND r.role_code='MANAJER_KINERJA') OR
  (u.username='risiko' AND r.role_code='MANAJER_RISIKO') OR
  (u.username='pimpinan' AND r.role_code='PIMPINAN_UNIT') OR
  (u.username='kepala.pusat' AND r.role_code='KEPALA_PUSAT_PPSPK') OR
  (u.username='renstra' AND r.role_code='BIDANG_RENSTRA') OR
  (u.username='kinerja.risiko' AND r.role_code='BIDANG_KINERJA_RISIKO')
)
ON CONFLICT DO NOTHING;

-- Safety check: demo data must use the real UKE-II organization.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM master.organization WHERE organization_code='UKE2-SEKJEN-PPSPK') THEN
    RAISE EXCEPTION 'Required organization UKE2-SEKJEN-PPSPK was not seeded.';
  END IF;
END $$;

COMMIT;
