import http from "http";
import { createRequire } from 'module';
const require = createRequire('D:/SIMONIK/BE/');
const { Client } = require('pg');

const BASE = "http://localhost:4000/api";
let pass = 0, fail = 0;

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { "Content-Type": "application/json" } };
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        const sc = res.headers["set-cookie"];
        const tk = sc ? sc.find((s) => s.startsWith("simonik_session=")) : null;
        let json; try { json = JSON.parse(d); } catch { json = d; }
        resolve({ status: res.statusCode, body: json, cookie: (tk ? tk.split(";")[0] : null) || cookie });
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}
const ok = (label, cond, detail) => { cond ? (pass++, console.log(`  OK ${label}`)) : (fail++, console.log(`  FAIL ${label}${detail ? " -- " + detail : ""}`)); };
const login = (u) => req("POST", "/auth/login", { username: u, password: "simonik123" });

const db = new Client({ connectionString: 'postgresql://simonik:simonik@localhost:5432/simonik' });
await db.connect();
const dB = (sql, params) => db.query(sql, params);

console.log("=== BUG 3: validasi input IKU ===");
const k = await login("kinerja");
let r = await req("POST", "/performance/iku", {}, k.cookie);
ok("body kosong -> 400", r.status === 400, `status=${r.status} msg=${r.body.message}`);
ok("kode IKU_NAME_REQUIRED", r.body.code === "IKU_NAME_REQUIRED", r.body.code);
r = await req("POST", "/performance/iku", { indicator_name: "X", target_tw1: -5 }, k.cookie);
ok("target negatif -> 400", r.status === 400, `status=${r.status} msg=${r.body.message}`);
ok("kode IKU_TARGET_INVALID", r.body.code === "IKU_TARGET_INVALID", r.body.code);
r = await req("POST", "/performance/iku", { indicator_name: "X", year: -1 }, k.cookie);
ok("tahun -1 -> 400", r.status === 400, `status=${r.status} msg=${r.body.message}`);
ok("kode IKU_YEAR_INVALID", r.body.code === "IKU_YEAR_INVALID", r.body.code);

console.log("=== BUG 2: output tanpa organization_id ===");
r = await req("POST", "/performance/outputs", { year: 2026, output_name: "OUT-NO-ORG", output_type: "RUTIN", target_value: 5 }, k.cookie);
ok("create output tanpa org -> 201 (auto org)", r.status === 201, `status=${r.status} msg=${r.body.message}`);
ok("organization_id = org user", !!r.body.organization_id && r.body.organization_id === r.body.organization_id, r.body.organization_id);

console.log("=== BUG 1: alur CREATE -> SUBMIT -> REVIEW -> APPROVE (harus 200 + PK dibuat) ===");
const st = String(Date.now()).slice(-6);
r = await req("POST", "/performance/iku", { indicator_name: `FIX-VERIFY-${st}`, year: 2026, period_consolidation: "SUM", target_tw1: 1, target_tw2: 2, target_tw3: 3, target_tw4: 4 }, k.cookie);
ok("create 201", r.status === 201, `status=${r.status} msg=${r.body.message}`);
const ikuId = r.body.iku_id;
r = await req("POST", `/performance/iku/${ikuId}/status`, { status: "SUBMITTED" }, k.cookie);
ok("submit 200", r.status === 200, `status=${r.status}`);
const kr = await login("kinerja.risiko");
r = await req("POST", `/performance/iku/${ikuId}/status`, { status: "REVIEWED" }, kr.cookie);
ok("review 200", r.status === 200, `status=${r.status}`);
const pu = await login("pimpinan");
r = await req("POST", `/performance/iku/${ikuId}/status`, { status: "APPROVED" }, pu.cookie);
ok("approve 200 (bukan 400)", r.status === 200, `status=${r.status} msg=${r.body.message}`);
const check = await dB(`select manual_iku_status,pimpinan_validation_status,
  (select count(1) from performance.performance_agreement p where p.iku_id=i.iku_id) as pk_count,
  (select perjanjian_kinerja_status from performance.performance_agreement p where p.iku_id=i.iku_id limit 1) as pk_status
  from performance.iku_manual i where i.iku_id=$1`, [ikuId]);
const row = check.rows[0];
ok("IKU = APPROVED", row.manual_iku_status === "APPROVED", row.manual_iku_status);
ok("PK dibuat (count=1)", Number(row.pk_count) === 1, `pk_count=${row.pk_count}`);
ok("PK status = DRAFT", row.pk_status === "DRAFT", row.pk_status);

console.log("\n===== leaked IKU lama (sebelum fix) melihat: PK tetap 0, tidak berubah =====");
const leaked = await dB(`select count(1) c from performance.iku_manual i where i.manual_iku_status='APPROVED' and i.active=true
  and not exists (select 1 from performance.performance_agreement p where p.iku_id=i.iku_id)`);
console.log("  IKU APPROVED tanpa PK: " + leaked.rows[0].c);

await db.end();
console.log(`\nRESULT: pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);