import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://simonik:simonik@localhost:5432/simonik' });
c.connect().then(async () => {
  const r = await c.query(`select indicator_name,manual_iku_status,bidang_validation_status,pimpinan_validation_status,
    (select count(1) from performance.performance_agreement p where p.iku_id=i.iku_id) as pk_count
    from performance.iku_manual i where i.indicator_name='UI-REPRO-269837'`);
  console.log(JSON.stringify(r.rows[0]));
  await c.end();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });