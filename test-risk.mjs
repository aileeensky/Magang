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
  const lris = await req('POST', '/auth/login', { username: 'risiko', password: 'simonik123' });
  const ck = lris.cookie;
  const me = await req('GET', '/auth/me', null, ck);
  const orgId = me.body?.user?.organization_id;
  console.log('risiko org:', me.body?.user?.organization_name);

  // Need an APPROVED IKU to link. Check if one exists in Biro SDM org
  const lk = await req('POST', '/auth/login', { username: 'kinerja', password: 'simonik123' });
  const ckk = lk.cookie;
  const ikus = await req('GET', '/performance/iku?year=2026', null, ckk);
  const approved = (ikus.body?.items || []).find(i => i.manual_iku_status === 'APPROVED');
  ok('Has APPROVED IKU in org', !!approved, 'none found');

  console.log('\n--- LKK create (correct fields) ---');
  const ts = Date.now();
  const lkk = await req('POST', '/risk/contexts', {
    organization_id: orgId, year: 2026,
    performance_iku_id: approved?.iku_id,
    external_context: 'Eksternal test', internal_context: 'Internal test',
  }, ck);
  ok('Create LKK', lkk.status === 201, `status=${lkk.status} ${JSON.stringify(lkk.body).slice(0,150)}`);
  const lkkId = lkk.body?.risk_context_id;

  console.log('\n--- Submit LKK flow ---');
  const lsub = await req('POST', '/risk/contexts/submit', { ids: [lkkId] }, ck);
  ok('Submit LKK', lsub.status === 200, `status=${lsub.status} ${JSON.stringify(lsub.body).slice(0,150)}`);

  // review by kinerja.risiko
  const lkr = await req('POST', '/auth/login', { username: 'kinerja.risiko', password: 'simonik123' });
  const ckr = lkr.cookie;
  const lrev = await req('POST', `/risk/contexts/${lkkId}/status`, { status: 'REVIEWED' }, ckr);
  ok('Review LKK', lrev.status === 200, `status=${lrev.status} ${JSON.stringify(lrev.body).slice(0,150)}`);

  // approve by pimpinan
  const lkp = await req('POST', '/auth/login', { username: 'pimpinan', password: 'simonik123' });
  const ckp = lkp.cookie;
  const lapp = await req('POST', `/risk/contexts/${lkkId}/status`, { status: 'APPROVED' }, ckp);
  ok('Approve LKK', lapp.status === 200, `status=${lapp.status} ${JSON.stringify(lapp.body).slice(0,150)}`);
  console.log('  (Note: pimpinan org=Biro SDM, LKK org=Biro SDM → in scope)');

  console.log('\n--- FAR create ---');
  const lkpimpinan = await req('POST', '/auth/login', { username: 'pimpinan', password: 'simonik123' });
  const cp = lkpimpinan.cookie;
  const ap = await req('POST', '/auth/login', { username: 'kepala.pusat', password: 'simonik123' });
  const ckp2 = ap.cookie;

  // risk categories from references
  const ref = await req('GET', '/risk/references', null, ck);
  const cats = ref.body?.risk_categories || [];
  ok('Got risk categories', cats.length > 0, `count=${cats.length}`);
  const catId = cats[0]?.risk_category_id;
  const catId2 = cats[1]?.risk_category_id;

  const far = await req('POST', '/risk/assessments', {
    risk_context_id: lkkId, risk_description: 'Risiko korupsi pada penyusunan dokumen',
    cause: 'Weak control', impact: 'Implementasi rendah', risk_category_id: catId,
    inherent_risk: 8, existing_control: 'Existing', internal_control_index: 6,
  }, ck);
  ok('Create FAR', far.status === 201, `status=${far.status} ${JSON.stringify(far.body).slice(0,200)}`);
  const farId = far.body?.risk_assessment_id;

  console.log('\n--- FAR auto-level check ---');
  ok('FAR has risk_level', !!far.body?.risk_level, `level=${far.body?.risk_level}`);
  ok('FAR has current_risk code', !!far.body?.current_risk, `current=${far.body?.current_risk}`);
  ok('FAR has IPI', !!far.body?.internal_control_index, `ipi=${far.body?.internal_control_index}`);

  console.log('\n--- IRU create ---');
  const iru = await req('POST', '/risk/indicators', {
    risk_assessment_id: farId, indicator_name: 'Indikator ' + ts, value_limit: 5, unit: 'x',
  }, ck);
  ok('Create IRU', iru.status === 201, `status=${iru.status} ${JSON.stringify(iru.body).slice(0,150)}`);
  const iruId = iru.body?.risk_indicator_id;

  console.log('\n--- FPR create ---');
  const fpr = await req('POST', '/risk/treatments', {
    risk_assessment_id: farId, treatment_plan: 'Rencana perlakuan ' + ts,
    required_resource: 'SDM', treatment_index: 5, schedule_date: '2026-12-31',
  }, ck);
  ok('Create FPR', fpr.status === 201, `status=${fpr.status} ${JSON.stringify(fpr.body).slice(0,200)}`);
  ok('FPR target_residual computed', !!fpr.body?.target_residual_risk, `target=${fpr.body?.target_residual_risk}`);

  console.log('\n--- Submit workflow FAR/IRU/FPR ---');
  const fsub = await req('POST', `/risk/assessments/${farId}/status`, { status: 'SUBMITTED' }, ck);
  ok('Submit FAR', fsub.status === 200, `status=${fsub.status} ${JSON.stringify(fsub.body).slice(0,120)}`);
  const irev = await req('POST', `/risk/indicators/${iruId}/status`, { status: 'REVIEWED' }, ckr);
  ok('Review IRU (by bidan!g) - expect 403', irev.status >= 400, `status=${irev.status}`);
  const fppub = await req('POST', `/risk/treatments/${fpr.body.risk_treatment_id}/status`, { status: 'SUBMITTED' }, ck);
  ok('Submit FPR', fppub.status === 200, `status=${fppub.status} ${JSON.stringify(fppub.body).slice(0,120)}`);

  console.log('\n--- Heatmap & Profile ---');
  const hm = await req('GET', '/risk/heatmap', null, ck);
  ok('GET /risk/heatmap', hm.status === 200, `status=${hm.status}`);
  const prof = await req('GET', '/risk/profile', null, ck);
  ok('GET /risk/profile', prof.status === 200, `status=${prof.status} count=${prof.body?.length}`);

  console.log('\n--- Monitoring create/update ---');
  const mon = await req('GET', '/monitoring', null, ck);
  ok('GET /monitoring', mon.status === 200, `status=${mon.status} count=${mon.body?.length ?? '?'}`);

  console.log(`\n=== RESULT: pass=${pass} fail=${fail} ===`);
  bugs.forEach(b => console.log('BUG:', b));
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });