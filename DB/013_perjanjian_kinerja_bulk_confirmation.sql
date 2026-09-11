-- 013_perjanjian_kinerja_bulk_confirmation.sql
-- Workflow PK: Manajer Kinerja -> Pimpinan UKE_II -> Pimpinan UKE_I.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='performance' AND table_name='performance_agreement' AND column_name='status')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='performance' AND table_name='performance_agreement' AND column_name='perjanjian_kinerja_status') THEN
    ALTER TABLE performance.performance_agreement RENAME COLUMN status TO perjanjian_kinerja_status;
  END IF;
END $$;
ALTER TABLE performance.performance_agreement
  DROP CONSTRAINT IF EXISTS performance_agreement_status_check;

UPDATE performance.performance_agreement SET perjanjian_kinerja_status='REVIEWED' WHERE perjanjian_kinerja_status='REVIEW';

ALTER TABLE performance.performance_agreement
  ADD CONSTRAINT performance_agreement_status_check
  CHECK (perjanjian_kinerja_status IN ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'));

CREATE INDEX IF NOT EXISTS idx_pk_year_org_status_bulk
  ON performance.performance_agreement(year, organization_id, perjanjian_kinerja_status, active);
