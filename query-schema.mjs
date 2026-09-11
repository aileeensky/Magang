import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://simonik:simonik@localhost:5432/simonik' });
c.connect().then(async () => {
  const cols = await c.query(`select column_name from information_schema.columns where table_schema='performance' and table_name='iku_manual' order by ordinal_position`);
  console.log('iku_manual cols:', cols.rows.map(r => r.column_name).join(', '));
  const rctx = await c.query(`select column_name from information_schema.columns where table_schema='risk' and table_name='risk_context' order by ordinal_position`);
  console.log('risk_context cols:', rctx.rows.map(r => r.column_name).join(', '));
  const levels = await c.query(`select organization_level, count(1) c from master.organization group by organization_level order by organization_level`);
  console.log('org levels:', levels.rows.map(r => `${r.organization_level}=${r.c}`).join(' | '));
  const sample = await c.query(`select organization_id,organization_code,organization_name,organization_level,parent_id from master.organization where organization_name in ('Biro SDM','Pusat Perencanaan Strategis PK','Sekretariat Jenderal')`);
  sample.rows.forEach(r => console.log(`  ${r.organization_name}: level=${r.organization_level} parent=${r.parent_id ? r.parent_id.slice(0,8) : null}`));
  await c.end();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });