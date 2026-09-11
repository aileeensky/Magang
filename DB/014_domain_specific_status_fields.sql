-- 014_domain_specific_status_fields.sql
-- Pisahkan field status Manual IKU dan Perjanjian Kinerja agar tidak
-- bertabrakan saat query/join dan lebih jelas di layer aplikasi.

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
  DROP CONSTRAINT IF EXISTS iku_manual_status_check;
ALTER TABLE performance.iku_manual
  ADD CONSTRAINT iku_manual_status_check
  CHECK (manual_iku_status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

ALTER TABLE performance.performance_agreement
  DROP CONSTRAINT IF EXISTS performance_agreement_status_check;
ALTER TABLE performance.performance_agreement
  ADD CONSTRAINT performance_agreement_status_check
  CHECK (perjanjian_kinerja_status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

DROP INDEX IF EXISTS idx_iku_manual_year_org_status;
CREATE INDEX IF NOT EXISTS idx_iku_manual_year_org_status
  ON performance.iku_manual(year, organization_id, manual_iku_status);

DROP INDEX IF EXISTS idx_pk_year_org_status;
DROP INDEX IF EXISTS idx_pk_year_org_status_bulk;
CREATE INDEX IF NOT EXISTS idx_pk_year_org_status_bulk
  ON performance.performance_agreement(year, organization_id, perjanjian_kinerja_status, active);
