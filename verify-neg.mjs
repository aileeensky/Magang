import http from "http";
const BASE = "http://localhost:4000/api";
function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { "Content-Type": "application/json" } };
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => { const sc = res.headers["set-cookie"]; const tk = sc ? sc.find((s) => s.startsWith("simonik_session=")) : null; let json; try { json = JSON.parse(d); } catch { json = d; } resolve({ status: res.statusCode, body: json, cookie: (tk ? tk.split(";")[0] : null) || cookie }); }); });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}
const login = (u) => req("POST", "/auth/login", { username: u, password: "simonik123" });
const k = await login("kinerja");
const r = await req("POST", "/performance/iku", { indicator_name: "X", year: 2026, target_tw1: -5, target_tw2: 5 }, k.cookie);
console.log(`status=${r.status} code=${r.body.code} msg=${r.body.message}`);
const r2 = await req("POST", "/performance/iku", { indicator_name: "Valid OK", year: 2026, target_tw1: 5 }, k.cookie);
console.log(`positive case: status=${r2.status} id=${r2.body.iku_id}`);
process.exit(0);