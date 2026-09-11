import http from "http";
const BASE = "http://localhost:4000/api";
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
        resolve({ status: res.statusCode, body: (() => { try { return JSON.parse(d); } catch { return d; } })(), cookie: (tk ? tk.split(";")[0] : null) || cookie });
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}
const login = (u) => req("POST", "/auth/login", { username: u, password: "simonik123" });

const k = await login("kinerja");
const st = String(Date.now()).slice(-6);
const created = await req("POST", "/performance/iku", {
  indicator_name: `UI-REPRO-${st}`,
  year: 2026, period_consolidation: "SUM",
  target_tw1: 10, target_tw2: 20, target_tw3: 30, target_tw4: 40,
}, k.cookie);
const ikuId = created.body.iku_id;
console.log("create:", created.status, ikuId);

const submitted = await req("POST", `/performance/iku/${ikuId}/status`, { status: "SUBMITTED" }, k.cookie);
console.log("submit:", submitted.status);

const kr = await login("kinerja.risiko");
const reviewed = await req("POST", `/performance/iku/${ikuId}/status`, { status: "REVIEWED" }, kr.cookie);
console.log("review:", reviewed.status, reviewed.body.bidang_validation_status);

console.log("RESULT=" + JSON.stringify({ iku_id: ikuId, ind: created.body.indicator_name, year: submitted.body.year, status: reviewed.body.manual_iku_status }));
process.exit(0);