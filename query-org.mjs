import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://simonik:simonik@localhost:5432/simonik' });
c.connect().then(async () => {
  const r = await c.query(`
    SELECT u.username, o.organization_code, o.organization_name
    FROM master.app_user u
    JOIN master.user_role ur ON ur.user_id=u.user_id
    JOIN master.organization o ON o.organization_id=ur.organization_id
    WHERE u.username IN ('admin','kinerja','risiko','pimpinan','kepala.pusat','renstra','kinerja.risiko')
    ORDER BY u.username`);
  r.rows.forEach(x => console.log(x.username.padEnd(14), x.organization_code.padEnd(22), x.organization_name));
  await c.end();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });