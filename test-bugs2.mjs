import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
import http from 'http';

const BASE = "http://localhost:4000/api";
let pass = 0, fail = 0, bugs = [];

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json' } };
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        const sc = res.headers['set-cookie'];
        const ck = sc?.find((s) => s.startsWith('simonik_session='));
        const tk = ck?.split(';')[0];
        let j; try { j = JSON.parse(d); } catch { j = d; }
        resolve({ status: res.statusCode, body: j, cookie: tk || cookie });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function ok(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; const m = `  ❌ ${label}${detail ? ' — ' + detail : ''}`; console.log(m); bugs.push(m); }
}

async function main() {
  const lk = await req('POST', '/auth/login', { username: 'kinerja', password: 'simonik123' });
  const ck = lk.cookie;
  const me = await req('GET', '/auth/me', null, ck);
  const orgId = me.body?.user?.organization_id;
  console.log('kinerja org:', me.body?.user?.organization_name, orgId);

  console.log('\n--- Output create (correct output_type) ---');
  const ts = Date.now();
  for (const t of ['PRIORITAS_NASIONAL', 'RUTIN']) {
    const r = await req('POST', '/performance/outputs', {
      organization_id: orgId, year: 2026, output_name: `Out-${t}-${ts}`,
      output_indicator: 'ind', output_type: t, target_value: 100, unit: 'dokumen', component: 'c',
    }, ck);
    ok(`Create output ${t}`, r.status === 201, `status=${r.status} ${JSON.stringify(r.body).slice(0,120)}`);
  }

  // Create output WITHOUT org_id (should be derived from session but isn't)
  const noOrg = await req('POST', '/performance/outputs', {
    year: 2026, output_name: 'NoOrg', output_indicator: 'i', output_type: 'RUTIN', target_value: 10,
  }, ck);
  ok('Output without org_id auto-fills from session', noOrg.status === 201, `status=${noOrg.status} ${JSON.stringify(noOrg.body).slice(0,120)}`);

  console.log('\n--- Define a fresh IKU + PK flow ---');
  // create IKU as kinerja (Biro SDM)
  const iku = await req('POST', '/performance/iku', {
    year: 2026, ss_name: 'SS-PK-' + ts, ss_description: 'd', iku_name: 'IKU-PK-' + ts,
    iku_description: 'd', formula: 'f', unit_pengukuran: 'persen', penanda: 'Renja',
    unit_kerja_level1: 'Sekretariat Jenderal', unit_kerja: 'Biro SDM',
    data_provider_unit: 'Biro SDM', data_validator_unit: 'Biro SDM',
    sumber_data: 's', tindakan_data: 't', konsolidasi_periode: 'SUM', konsolidasi_lokasi: 'SUM',
    jenis_cascading: 'FULLY', polarisasi: 'MAXIMIZE', periode_pelaporan: 'QUARTERLY',
    target_tw1: 1, target_tw2: 2, target_tw3: 3, target_tw4: 4, target_tahunan: 10,
  }, ck);
  const ikuId = iku.body?.iku_id;
  ok('Create IKU (Biro SDM)', iku.status === 201 && !!ikuId, `status=${iku.status}`);

  // submit
  const sub = await req('POST', `/performance/iku/${ikuId}/status`, { status: 'SUBMITTED' }, ck);
  ok('Submit IKU', sub.status === 200, `status=${sub.status}`);

  // review by kinerja.risiko (PPSPK)
  const lkr = await req('POST', '/auth/login', { username: 'kinerja.risiko', password: 'simonik123' });
  const ckr = lkr.cookie;
  const rev = await req('POST', `/performance/iku/${ikuId}/status`, { status: 'REVIEWED' }, ckr);
  ok('Review IKU by kinerja.risiko (cross-org!)', rev.status === 200, `status=${rev.status} ${JSON.stringify(rev.body).slice(0,120)}`);

  // approve by pimpinan (Biro SDM)
  const lkp = await req('POST', '/auth/login', { username: 'pimpinan', password: 'simonik123' });
  const ckp = lkp.cookie;
  const app = await req('POST', `/performance/iku/${ikuId}/status`, { status: 'APPROVED' }, ckp);
  ok('Approve IKU (expect fail due to status column bug)', app.status === 200, `status=${app.status} ${JSON.stringify(app.body).slice(0,160)}`);

  console.log('\n--- PK list ---');
  const pks = await req('GET', '/performance/pks?year=2026', null, ck);
  const items = pks.body?.items || [];
  ok('GET pks', pks.status === 200, `status=${pks.status} count=${items.length}`);

  console.log('\n--- LKK create (proper fields) ---');
  const lris = await req('POST', '/auth/login', { username: 'risiko', password: 'simonik123' });
  const cris = lris.cookie;
  const lkk = await req('POST', '/risk/contexts', {
    year: 2026, context_name: 'LKK-Test-' + ts, context_description: 'desc',
    unit_kerja: 'Biro SDM', unit_kerja_level1: 'Sekretariat Jenderal',
  }, cris);
  ok('Create LKK', lkk.status === 201 || lkk.status === 200, `status=${lkk.status} ${JSON.stringify(lkk.body).slice(0,160)}`);

  console.log('\n--- PK submit/confirm-bulk field schema ---');
  // check what fields are required
  const subB = await req('POST', '/performance/pks/submit-bulk', { ids: [] }, ck);
  ok('submit-bulk empty accept', [400, 200, 422].includes(subB.status), `status=${subB.status} ${JSON.stringify(subB.body).slice(0,160)}`);

  const confB = await req('POST', '/performance/pks/confirm-bulk', { ids: [] }, ckp);
  ok('confirm-bulk empty accept', [400, 200, 422].includes(confB.status), `status=${confB.status} ${JSON.stringify(confB.body).slice(0,160)}`);

  console.log(`\n=== RESULT: pass=${pass} fail=${fail} ===`);
  bugs.forEach(b => console.log('BUG:', b));
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });