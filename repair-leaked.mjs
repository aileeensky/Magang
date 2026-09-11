import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://simonik:simonik@localhost:5432/simonik' });
c.connect().then(async () => {
  const updated = await c.query(`update performance.iku_manual i set
      manual_iku_status='REVIEWED',
      pimpinan_validation_status='PENDING',
      pending_action='NONE',
      updated_at=now()
    where i.manual_iku_status='APPROVED' and i.active=true
      and not exists (select 1 from performance.performance_agreement p where p.iku_id=i.iku_id)
    returning i.indicator_name` , []);
  console.log('Reverted rows:', updated.rowCount);
  updated.rows.forEach(r => console.log('  -', r.indicator_name));
  const leaked = await c.query(`select count(1) c from performance.iku_manual i
    where i.manual_iku_status='APPROVED' and i.active=true
      and not exists (select 1 from performance.performance_agreement p where p.iku_id=i.iku_id)`);
  console.log('Sisa IKU APPROVED tanpa PK:', leaked.rows[0].c);
  await c.end();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });