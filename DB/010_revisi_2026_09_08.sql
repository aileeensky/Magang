-- 010_manual_iku_lkk_workflow.sql
-- Revisi tampilan SIMONIK 08/09/2026

-- Pisahkan field status domain performance agar Manual IKU dan PK tidak berbenturan.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='performance' AND table_name='iku_manual' AND column_name='status')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='performance' AND table_name='iku_manual' AND column_name='manual_iku_status') THEN
    ALTER TABLE performance.iku_manual RENAME COLUMN status TO manual_iku_status;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='performance' AND table_name='performance_agreement' AND column_name='status')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='performance' AND table_name='performance_agreement' AND column_name='perjanjian_kinerja_status') THEN
    ALTER TABLE performance.performance_agreement RENAME COLUMN status TO perjanjian_kinerja_status;
  END IF;
END $$;

ALTER TABLE performance.iku_manual
  ADD COLUMN IF NOT EXISTS renja_type varchar(20),
  ADD COLUMN IF NOT EXISTS target_annual numeric(20,6),
  ADD COLUMN IF NOT EXISTS bidang_validation_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS bidang_rejection_reason text,
  ADD COLUMN IF NOT EXISTS pimpinan_validation_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS pimpinan_rejection_reason text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_action varchar(20) NOT NULL DEFAULT 'NONE';

ALTER TABLE performance.iku_manual
  DROP CONSTRAINT IF EXISTS iku_manual_renja_type_check;
ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_renja_type_check
  CHECK (renja_type IS NULL OR renja_type IN ('RENJA','NON_RENJA'));

ALTER TABLE performance.iku_manual
  DROP CONSTRAINT IF EXISTS iku_manual_bidang_validation_check;
ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_bidang_validation_check
  CHECK (bidang_validation_status IN ('PENDING','APPROVED','REJECTED'));

ALTER TABLE performance.iku_manual
  DROP CONSTRAINT IF EXISTS iku_manual_pending_action_check;
ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_pending_action_check
  CHECK (pending_action IN ('NONE','EDIT','DELETE'));

ALTER TABLE performance.iku_manual
  DROP CONSTRAINT IF EXISTS iku_manual_pimpinan_validation_check;
ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_pimpinan_validation_check
  CHECK (pimpinan_validation_status IN ('PENDING','APPROVED','REJECTED'));

ALTER TABLE performance.performance_agreement
  ADD COLUMN IF NOT EXISTS bidang_validation_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS bidang_rejection_reason text,
  ADD COLUMN IF NOT EXISTS pimpinan_validation_status varchar(20) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS pimpinan_rejection_reason text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE risk.risk_context
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS selected_for_submission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_iku_manual_year_org_status
  ON performance.iku_manual(year, organization_id, manual_iku_status);
CREATE INDEX IF NOT EXISTS idx_iku_manual_active
  ON performance.iku_manual(active);
CREATE INDEX IF NOT EXISTS idx_pk_year_org_status
  ON performance.performance_agreement(year, organization_id, perjanjian_kinerja_status);
CREATE INDEX IF NOT EXISTS idx_risk_context_year
  ON risk.risk_context(created_at);

-- Backfill target tahunan mengikuti konsolidasi periode.
UPDATE performance.iku_manual
SET target_annual = CASE period_consolidation
  WHEN 'SUM' THEN COALESCE(target_tw1,0)+COALESCE(target_tw2,0)+COALESCE(target_tw3,0)+COALESCE(target_tw4,0)
  WHEN 'AVERAGE' THEN (
    COALESCE(target_tw1,0)+COALESCE(target_tw2,0)+COALESCE(target_tw3,0)+COALESCE(target_tw4,0)
  ) / 4.0
  WHEN 'TAKE_LAST_KNOWN' THEN target_tw4
END
WHERE target_annual IS NULL;

-- Dokumen lama yang sudah APPROVED dianggap sudah melewati kedua validasi.
UPDATE performance.iku_manual
SET bidang_validation_status='APPROVED', pimpinan_validation_status='APPROVED'
WHERE manual_iku_status='APPROVED';

UPDATE performance.performance_agreement
SET bidang_validation_status='APPROVED', pimpinan_validation_status='APPROVED'
WHERE perjanjian_kinerja_status='APPROVED';

ALTER TABLE risk.risk_context
  ADD COLUMN IF NOT EXISTS output_detail text,
  ADD COLUMN IF NOT EXISTS business_process_detail text;

-- Workflow Manual IKU menggunakan status SUBMITTED dan REVIEWED.
-- Normalisasi data lama sebelum memasang CHECK baru agar migrasi tidak gagal
-- bila masih ada status legacy 'REVIEW'.
ALTER TABLE performance.iku_manual
  DROP CONSTRAINT IF EXISTS iku_manual_status_check;

UPDATE performance.iku_manual
SET manual_iku_status='REVIEWED'
WHERE manual_iku_status='REVIEW';

UPDATE performance.iku_manual
SET manual_iku_status='DRAFT'
WHERE manual_iku_status IS NULL
   OR manual_iku_status NOT IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED');

ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_status_check
  CHECK (manual_iku_status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));
