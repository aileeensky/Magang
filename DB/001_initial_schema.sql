-- SIMONIK - 001_initial_schema.sql
-- Clean rebuild from an empty PostgreSQL database.
-- Run this file first. It contains the complete relational structure;
-- later migrations are not required for a fresh installation.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS master;
CREATE SCHEMA IF NOT EXISTS planning;
CREATE SCHEMA IF NOT EXISTS performance;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS employee_performance;
CREATE SCHEMA IF NOT EXISTS system;

-- =========================================================
-- MASTER
-- =========================================================
CREATE TABLE master.organization (
  organization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES master.organization(organization_id),
  organization_code varchar(50) UNIQUE NOT NULL,
  organization_name varchar(255) NOT NULL,
  organization_level varchar(30),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master.employee (
  employee_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES master.organization(organization_id),
  employee_number varchar(50) UNIQUE NOT NULL,
  employee_name varchar(255) NOT NULL,
  position_name varchar(255),
  email varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid UNIQUE NOT NULL REFERENCES master.employee(employee_id),
  username varchar(100) UNIQUE NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE master.role (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code varchar(50) UNIQUE NOT NULL,
  role_name varchar(100) NOT NULL,
  description text
);

CREATE TABLE master.user_role (
  user_id uuid NOT NULL REFERENCES master.app_user(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES master.role(role_id),
  organization_id uuid NOT NULL REFERENCES master.organization(organization_id),
  PRIMARY KEY (user_id, role_id, organization_id)
);

CREATE TABLE master.period (
  period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year smallint NOT NULL,
  period_type varchar(20) NOT NULL,
  period_no smallint,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  UNIQUE(year, period_type, period_no)
);

CREATE TABLE master.business_process (
  business_process_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name text NOT NULL,
  level smallint,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE master.risk_category (
  risk_category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  name varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE master.risk_level_rule (
  risk_level_rule_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_score numeric(10,2) NOT NULL,
  max_score numeric(10,2) NOT NULL,
  level_name varchar(100) NOT NULL,
  source_note text,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (min_score <= max_score)
);

-- =========================================================
-- PLANNING
-- strategic_objective is the canonical master for Sasaran Strategis.
-- Manual IKU references it directly by FK.
-- =========================================================
CREATE TABLE planning.strategic_objective (
  strategic_objective_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renstra_id uuid,
  code varchar(50),
  name text NOT NULL,
  description text,
  UNIQUE(code)
);

CREATE TABLE planning.activity_objective (
  activity_objective_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid,
  code varchar(50),
  name text NOT NULL,
  description text
);

CREATE TABLE planning.activity_indicator (
  activity_indicator_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_objective_id uuid NOT NULL REFERENCES planning.activity_objective(activity_objective_id),
  indicator_code varchar(50),
  indicator_name text NOT NULL,
  target_value numeric(20,6),
  unit varchar(100)
);

CREATE TABLE planning.output (
  output_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid,
  classification_id uuid,
  code varchar(50),
  name text NOT NULL,
  target_value numeric(20,6),
  unit varchar(100)
);

-- =========================================================
-- PERFORMANCE
-- =========================================================
CREATE TABLE performance.iku_manual (
  iku_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES master.organization(organization_id),
  year smallint NOT NULL,

  -- Canonical relation to Planning.
  strategic_objective_id uuid REFERENCES planning.strategic_objective(strategic_objective_id),
  -- Compatibility/snapshot only; the FK above is authoritative.
  strategic_objective_name text,
  strategic_objective_description text,

  indicator_name text NOT NULL,
  indicator_description text,
  formula text,
  measurement_unit varchar(255),
  data_provider_org_id uuid REFERENCES master.organization(organization_id),
  data_source text,
  data_validator_org_id uuid REFERENCES master.organization(organization_id),
  missing_data_action text,

  period_consolidation varchar(30) NOT NULL
    CHECK (period_consolidation IN ('SUM','AVERAGE','TAKE_LAST_KNOWN')),
  cascading_type varchar(30) NOT NULL
    CHECK (cascading_type IN ('FULLY','PARTIALLY','NON_DIRECT')),
  location_consolidation varchar(30) NOT NULL
    CHECK (location_consolidation IN ('SUM','AVERAGE','RAW_DATA')),
  polarization varchar(20) NOT NULL
    CHECK (polarization IN ('MAXIMIZE','STABILIZE','MINIMIZE')),
  reporting_period varchar(20) NOT NULL
    CHECK (reporting_period IN ('MONTHLY','QUARTERLY','SEMESTERLY','YEARLY')),

  target_tw1 numeric(20,6),
  target_tw2 numeric(20,6),
  target_tw3 numeric(20,6),
  target_tw4 numeric(20,6),

  manual_iku_status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (manual_iku_status IN ('DRAFT','REVIEW','APPROVED','REJECTED')),
  bidang_validation_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (bidang_validation_status IN ('PENDING','APPROVED','REJECTED')),
  bidang_rejection_reason text,
  pimpinan_validation_status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (pimpinan_validation_status IN ('PENDING','APPROVED','REJECTED')),
  pimpinan_rejection_reason text,
  active boolean NOT NULL DEFAULT true,
  pending_action varchar(20) NOT NULL DEFAULT 'NONE'
    CHECK (pending_action IN ('NONE','EDIT','DELETE')),
  target_annual numeric(20,6),
  renja_type varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performance.performance_agreement (
  agreement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES master.organization(organization_id),
  year smallint NOT NULL,
  strategic_objective_id uuid REFERENCES planning.strategic_objective(strategic_objective_id),
  iku_id uuid NOT NULL REFERENCES performance.iku_manual(iku_id),
  target_tw1 numeric(20,6),
  target_tw2 numeric(20,6),
  target_tw3 numeric(20,6),
  target_tw4 numeric(20,6),
  perjanjian_kinerja_status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (perjanjian_kinerja_status IN ('DRAFT','REVIEW','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, year, iku_id)
);

CREATE TABLE performance.output_manual (
  output_manual_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES master.organization(organization_id),
  year smallint NOT NULL,
  classification_code varchar(100),
  output_name text NOT NULL,
  output_indicator text,
  output_type varchar(20) NOT NULL
    CHECK (output_type IN ('PRIORITAS_NASIONAL','RUTIN')),
  target_value numeric(20,6),
  unit varchar(100),
  component text,
  status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEW','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- RISK
-- =========================================================
CREATE TABLE risk.risk_context (
  risk_context_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES master.organization(organization_id),

  -- Legacy planning references retained for old data compatibility.
  activity_objective_id uuid REFERENCES planning.activity_objective(activity_objective_id),
  activity_indicator_id uuid REFERENCES planning.activity_indicator(activity_indicator_id),
  output_id uuid REFERENCES planning.output(output_id),

  -- Canonical operational references: Risk -> Performance.
  performance_iku_id uuid REFERENCES performance.iku_manual(iku_id),
  performance_agreement_id uuid REFERENCES performance.performance_agreement(agreement_id),
  performance_output_manual_id uuid REFERENCES performance.output_manual(output_manual_id),

  business_process_id uuid REFERENCES master.business_process(business_process_id),
  external_context text,
  internal_context text,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES master.app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE risk.risk_assessment (
  risk_assessment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_context_id uuid NOT NULL REFERENCES risk.risk_context(risk_context_id) ON DELETE CASCADE,
  risk_code varchar(50),
  risk_description text NOT NULL,
  cause text,
  impact text,
  risk_category_id uuid NOT NULL REFERENCES master.risk_category(risk_category_id),
  inherent_risk varchar(2),
  existing_control text,
  internal_control_index numeric(3,2) CHECK (internal_control_index BETWEEN 0 AND 1),
  current_risk varchar(2),
  risk_level varchar(50),
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(risk_context_id, risk_code)
);

CREATE TABLE risk.risk_indicator (
  risk_indicator_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_assessment_id uuid NOT NULL REFERENCES risk.risk_assessment(risk_assessment_id) ON DELETE CASCADE,
  indicator_name text NOT NULL,
  value_limit text,
  unit varchar(100),
  status varchar(30) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE risk.risk_treatment (
  risk_treatment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_assessment_id uuid NOT NULL REFERENCES risk.risk_assessment(risk_assessment_id) ON DELETE CASCADE,
  treatment_plan text NOT NULL,
  required_resource text,
  treatment_index numeric(3,2) CHECK (treatment_index BETWEEN 0 AND 1),
  target_residual_risk varchar(2),
  schedule_date date,
  pic_employee_id uuid REFERENCES master.employee(employee_id),
  status varchar(30) NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE risk.risk_monitoring (
  risk_monitoring_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_treatment_id uuid NOT NULL REFERENCES risk.risk_treatment(risk_treatment_id) ON DELETE CASCADE,
  monitoring_date date NOT NULL DEFAULT current_date,
  monitoring_review text,
  actual_risk varchar(20),
  trend varchar(20) CHECK (trend IN ('DECREASE','INCREASE','STABLE')),
  reviewed_by uuid REFERENCES master.app_user(user_id),
  reviewed_at timestamptz
);

-- =========================================================
-- SYSTEM
-- =========================================================
CREATE TABLE system.workflow_document (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type varchar(50) NOT NULL,
  reference_id uuid NOT NULL,
  organization_id uuid REFERENCES master.organization(organization_id),
  current_status varchar(30) NOT NULL DEFAULT 'DRAFT',
  created_by uuid REFERENCES master.app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system.workflow_history (
  workflow_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES system.workflow_document(document_id) ON DELETE CASCADE,
  from_status varchar(30),
  to_status varchar(30) NOT NULL,
  action varchar(30) NOT NULL,
  actor_user_id uuid REFERENCES master.app_user(user_id),
  notes text,
  action_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE system.audit_log (
  audit_id bigserial PRIMARY KEY,
  user_id uuid REFERENCES master.app_user(user_id),
  organization_id uuid REFERENCES master.organization(organization_id),
  action varchar(30) NOT NULL,
  table_name varchar(150) NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE system.user_session (
  session_id varchar(128) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES master.app_user(user_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX idx_risk_context_org ON risk.risk_context(organization_id);
CREATE INDEX idx_risk_context_status_org ON risk.risk_context(organization_id,status);
CREATE INDEX idx_risk_context_performance_iku ON risk.risk_context(performance_iku_id);
CREATE INDEX idx_risk_context_performance_pk ON risk.risk_context(performance_agreement_id);
CREATE INDEX idx_risk_context_performance_output ON risk.risk_context(performance_output_manual_id);
CREATE INDEX idx_risk_assessment_context ON risk.risk_assessment(risk_context_id);
CREATE INDEX idx_risk_assessment_status ON risk.risk_assessment(status,risk_context_id);
CREATE INDEX idx_risk_indicator_assessment_status ON risk.risk_indicator(risk_assessment_id,status);
CREATE INDEX idx_risk_treatment_assessment ON risk.risk_treatment(risk_assessment_id);
CREATE INDEX idx_risk_treatment_status ON risk.risk_treatment(status,risk_assessment_id);
CREATE INDEX idx_risk_monitoring_treatment ON risk.risk_monitoring(risk_treatment_id);
CREATE INDEX idx_risk_monitoring_date ON risk.risk_monitoring(risk_treatment_id,monitoring_date DESC);

CREATE INDEX idx_iku_org_year ON performance.iku_manual(organization_id,year);
CREATE INDEX idx_iku_strategic_objective ON performance.iku_manual(strategic_objective_id);
CREATE INDEX idx_pk_org_year ON performance.performance_agreement(organization_id,year);
CREATE INDEX idx_pk_iku ON performance.performance_agreement(iku_id);
CREATE INDEX idx_pk_strategic_objective ON performance.performance_agreement(strategic_objective_id);
CREATE INDEX idx_output_org_year ON performance.output_manual(organization_id,year);

CREATE INDEX idx_risk_level_rule_score
  ON master.risk_level_rule(min_score,max_score)
  WHERE is_active = true;
CREATE INDEX idx_workflow_document_reference
  ON system.workflow_document(reference_id,document_type);
CREATE UNIQUE INDEX uq_workflow_document_type_reference
  ON system.workflow_document(document_type,reference_id);
CREATE INDEX idx_workflow_history_document_action_at
  ON system.workflow_history(document_id,action_at);
CREATE INDEX idx_user_session_expires_at ON system.user_session(expires_at);
CREATE INDEX idx_user_session_user_id ON system.user_session(user_id);

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION performance.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_iku_updated
BEFORE UPDATE ON performance.iku_manual
FOR EACH ROW EXECUTE FUNCTION performance.set_updated_at();

CREATE TRIGGER trg_pk_updated
BEFORE UPDATE ON performance.performance_agreement
FOR EACH ROW EXECUTE FUNCTION performance.set_updated_at();

CREATE TRIGGER trg_output_updated
BEFORE UPDATE ON performance.output_manual
FOR EACH ROW EXECUTE FUNCTION performance.set_updated_at();

-- =========================================================
-- DOCUMENTATION
-- =========================================================
COMMENT ON COLUMN performance.iku_manual.strategic_objective_id IS
  'Canonical FK ke planning.strategic_objective. Gunakan kolom ini sebagai source of truth.';

COMMENT ON COLUMN performance.iku_manual.strategic_objective_name IS
  'Snapshot/compatibility field. Bukan sumber relasi utama.';

COMMENT ON COLUMN risk.risk_context.activity_objective_id IS
  'LEGACY. Untuk data Risiko baru gunakan performance_iku_id/performance_agreement_id/performance_output_manual_id.';

COMMENT ON COLUMN risk.risk_context.activity_indicator_id IS
  'LEGACY. Untuk data Risiko baru gunakan referensi Performance.';

COMMENT ON COLUMN risk.risk_context.output_id IS
  'LEGACY. Untuk data Risiko baru gunakan referensi Performance.';

COMMENT ON COLUMN risk.risk_context.performance_iku_id IS
  'Primary operational link from Risk to Performance.';

COMMENT ON COLUMN risk.risk_context.performance_agreement_id IS
  'Optional operational link from Risk to Performance Agreement.';

COMMENT ON COLUMN risk.risk_context.performance_output_manual_id IS
  'Optional operational link from Risk to Performance Output Manual.';

COMMIT;
