import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://simonik:simonik@localhost:5432/simonik' });
c.connect().then(async () => {
  const iku = await c.query(`
    SELECT i.indicator_name, i.manual_iku_status, i.bidang_validation_status, i.pimpinan_validation_status,
           o.organization_name,
           EXISTS (SELECT 1 FROM performance.performance_agreement p WHERE p.iku_id = i.iku_id AND p.active=true) AS has_pk
    FROM performance.iku_manual i
    JOIN master.organization o ON o.organization_id = i.organization_id
    ORDER BY i.created_at DESC LIMIT 12`);
  console.log('IKU records (latest first):');
  iku.rows.forEach(r => console.log(
    `  ${String(r.indicator_name || 'NULL').slice(0, 35).padEnd(37)} status=${String(r.manual_iku_status).padEnd(9)} bidang=${String(r.bidang_validation_status).padEnd(8)} pimpinan=${String(r.pimpinan_validation_status).padEnd(8)} hasPK=${r.has_pk} org=${r.organization_name}`));
  await c.end();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });