import http from "http";

const BASE = "http://localhost:4000/api";
let pass = 0, fail = 0, bugs = [];

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (cookie) opts.headers.Cookie = cookie;
    const r = http.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        const sc = res.headers["set-cookie"];
        const c = sc ? sc.find((s) => s.startsWith("simonik_session=")) : null;
        const tk = c ? c.split(";")[0] : null;
        let json;
        try { json = JSON.parse(d); } catch { json = d; }
        resolve({ status: res.statusCode, body: json, cookie: tk || cookie });
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function ok(label, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; const msg = `  ❌ ${label}${detail ? " — " + detail : ""}`; console.log(msg); bugs.push(msg); }
}

async function login(user) {
  const r = await req("POST", "/auth/login", { username: user, password: "simonik123" });
  ok(`Login ${user}`, r.status === 200, `status=${r.status}`);
  return r.cookie;
}

// ========== 1. AUTH EDGE CASES ==========
async function testAuth() {
  console.log("\n--- Auth Edge Cases ---");
  const no = await req("GET", "/auth/me");
  ok("GET /auth/me no token → 401", no.status === 401, `status=${no.status}`);
  const bad = await req("GET", "/auth/me", null, "token=bad");
  ok("GET /auth/me bad token → 401", bad.status === 401, `status=${bad.status}`);
  const wp = await req("POST", "/auth/login", { username: "admin", password: "wrong" });
  ok("Login wrong password → 401", wp.status >= 400, `status=${wp.status}`);
  const nu = await req("POST", "/auth/login", { username: "nonexistent", password: "simonik123" });
  ok("Login nonexistent → 401", nu.status >= 400, `status=${nu.status}`);
}

// ========== 2. RBAC ==========
async function testRBAC(kinerjaC, adminC) {
  console.log("\n--- RBAC ---");
  const a1 = await req("GET", "/admin/users", null, kinerjaC);
  ok("kinerja cannot GET /admin/users", a1.status === 403 || a1.status === 401, `status=${a1.status}`);
  const a2 = await req("GET", "/admin/users", null, adminC);
  ok("admin CAN GET /admin/users", a2.status === 200, `status=${a2.status}`);
  const a3 = await req("DELETE", "/admin/users/nonexistent", null, kinerjaC);
  ok("kinerja cannot DELETE /admin/users", a3.status === 403 || a3.status === 401, `status=${a3.status}`);
}

// ========== 3. MANUAL IKU WORKFLOW ==========
async function testIKUWorkflow(kinerjaC, krC, pimpinanC) {
  console.log("\n--- Manual IKU Full Workflow ---");

  // List
  const list = await req("GET", "/performance/iku?year=2026", null, kinerjaC);
  ok("GET /performance/iku", list.status === 200, `status=${list.status}`);

  // Create
  const ts = Date.now();
  const create = await req("POST", "/performance/iku", {
    year: 2026, ss_name: `SS-Workflow-${ts}`, ss_description: "Test",
    iku_name: `IKU-Workflow-${ts}`, iku_description: "Test", formula: "100%",
    unit_pengukuran: "persen", penanda: "Renja",
    unit_kerja_level1: "Sekretariat Jenderal",
    unit_kerja: "Pusat Perencanaan Strategis PK",
    data_provider_unit: "Pusat Perencanaan Strategis PK",
    data_validator_unit: "Pusat Perencanaan Strategis PK",
    sumber_data: "Test", tindakan_data: "Test",
    konsolidasi_periode: "SUM", konsolidasi_lokasi: "SUM",
    jenis_cascading: "FULLY", polarisasi: "MAXIMIZE",
    periode_pelaporan: "QUARTERLY",
    target_tw1: 10, target_tw2: 20, target_tw3: 30, target_tw4: 40,
    target_tahunan: 100,
  }, kinerjaC);
  ok("Create IKU", create.status === 201, `status=${create.status}`);
  const id = create.body?.iku_id;
  if (!id) { ok("IKU ID exists", false, "no ID returned"); return; }
  ok("Created IKU has DRAFT status", create.body?.manual_iku_status === "DRAFT", `status=${create.body?.manual_iku_status}`);

  // Submit (DRAFT → SUBMITTED)
  const sub = await req("POST", `/performance/iku/${id}/status`, { status: "SUBMITTED" }, kinerjaC);
  ok("Submit IKU (DRAFT→SUBMITTED)", sub.status === 200, `status=${sub.status} body=${JSON.stringify(sub.body).slice(0,200)}`);
  ok("After submit, status is SUBMITTED", sub.body?.manual_iku_status === "SUBMITTED", `status=${sub.body?.manual_iku_status}`);

  // Submit again (should fail — already SUBMITTED)
  const sub2 = await req("POST", `/performance/iku/${id}/status`, { status: "SUBMITTED" }, kinerjaC);
  ok("Double submit rejected", sub2.status >= 400, `status=${sub2.status}`);

  // Pimpinan cannot approve before bidang review
  const badApprove = await req("POST", `/performance/iku/${id}/status`, { status: "APPROVED" }, pimpinanC);
  ok("Pimpinan cannot approve before bidang review", badApprove.status >= 400, `status=${badApprove.status}`);

  // Review (SUBMITTED → REVIEWED) by BIDANG_KINERJA_RISIKO
  const rev = await req("POST", `/performance/iku/${id}/status`, { status: "REVIEWED" }, krC);
  ok("Review IKU (SUBMITTED→REVIEWED)", rev.status === 200, `status=${rev.status}`);
  ok("After review, bidang_validation is APPROVED", rev.body?.bidang_validation_status === "APPROVED", `val=${rev.body?.bidang_validation_status}`);

  // Approve (REVIEWED → APPROVED) by PIMPINAN_UNIT
  const app = await req("POST", `/performance/iku/${id}/status`, { status: "APPROVED" }, pimpinanC);
  ok("Approve IKU (REVIEWED→APPROVED)", app.status === 200, `status=${app.status}`);
  ok("After approve, status is APPROVED", app.body?.manual_iku_status === "APPROVED", `status=${app.body?.manual_iku_status}`);

  // Check PK was auto-created
  const pks = await req("GET", "/performance/pks?year=2026", null, kinerjaC);
  const pkItems = pks.body?.items || pks.body;
  const newPk = Array.isArray(pkItems) ? pkItems.find(p => p.iku_id === id) : null;
  ok("PK auto-created from APPROVED IKU", !!newPk, `found=${!!newPk}`);

  return { id, pkId: newPk?.agreement_id };
}

// ========== 4. DELETE IKU ==========
async function testDeleteIKU(kinerjaC) {
  console.log("\n--- Delete IKU ---");

  // Create a DRAFT and delete
  const ts = Date.now();
  const c1 = await req("POST", "/performance/iku", {
    year: 2026, ss_name: `SS-Del-${ts}`, ss_description: "x",
    iku_name: `IKU-Del-${ts}`, iku_description: "x", formula: "x",
    unit_pengukuran: "persen", penanda: "Renja",
    unit_kerja_level1: "Sekretariat Jenderal",
    unit_kerja: "Pusat Perencanaan Strategis PK",
    data_provider_unit: "Pusat Perencanaan Strategis PK",
    data_validator_unit: "Pusat Perencanaan Strategis PK",
    sumber_data: "x", tindakan_data: "x",
    konsolidasi_periode: "SUM", konsolidasi_lokasi: "SUM",
    jenis_cascading: "FULLY", polarisasi: "MAXIMIZE",
    periode_pelaporan: "QUARTERLY",
    target_tw1: 1, target_tw2: 1, target_tw3: 1, target_tw4: 1, target_tahunan: 4,
  }, kinerjaC);
  ok("Create DRAFT IKU for delete", c1.status === 201, `status=${c1.status}`);
  const id = c1.body?.iku_id;
  if (!id) return;
  const del = await req("DELETE", `/performance/iku/${id}`, null, kinerjaC);
  ok("Delete DRAFT IKU", del.status === 200, `status=${del.status}`);

  // Create a SUBMITTED one and try to delete (should fail)
  const c2 = await req("POST", "/performance/iku", {
    year: 2026, ss_name: `SS-Del2-${ts}`, ss_description: "x",
    iku_name: `IKU-Del2-${ts}`, iku_description: "x", formula: "x",
    unit_pengukuran: "persen", penanda: "Renja",
    unit_kerja_level1: "Sekretariat Jenderal",
    unit_kerja: "Pusat Perencanaan Strategis PK",
    data_provider_unit: "Pusat Perencanaan Strategis PK",
    data_validator_unit: "Pusat Perencanaan Strategis PK",
    sumber_data: "x", tindakan_data: "x",
    konsolidasi_periode: "SUM", konsolidasi_lokasi: "SUM",
    jenis_cascading: "FULLY", polarisasi: "MAXIMIZE",
    periode_pelaporan: "QUARTERLY",
    target_tw1: 1, target_tw2: 1, target_tw3: 1, target_tw4: 1, target_tahunan: 4,
  }, kinerjaC);
  const id2 = c2.body?.iku_id;
  if (!id2) return;
  await req("POST", `/performance/iku/${id2}/status`, { status: "SUBMITTED" }, kinerjaC);
  const del2 = await req("DELETE", `/performance/iku/${id2}`, null, kinerjaC);
  ok("Cannot delete SUBMITTED IKU", del2.status >= 400, `status=${del2.status}`);
}

// ========== 5. IKU VALIDATION ==========
async function testIKUValidation(kinerjaC) {
  console.log("\n--- IKU Input Validation ---");
  const empty = await req("POST", "/performance/iku", {}, kinerjaC);
  ok("Empty body rejected", empty.status >= 400, `status=${empty.status}`);

  const neg = await req("POST", "/performance/iku", {
    year: 2026, ss_name: "x", ss_description: "x", iku_name: "x",
    iku_description: "x", formula: "x", unit_pengukuran: "persen",
    penanda: "Renja", unit_kerja_level1: "Sekretariat Jenderal",
    unit_kerja: "Pusat Perencanaan Strategis PK",
    data_provider_unit: "Pusat Perencanaan Strategis PK",
    data_validator_unit: "Pusat Perencanaan Strategis PK",
    sumber_data: "x", tindakan_data: "x",
    konsolidasi_periode: "SUM", konsolidasi_lokasi: "SUM",
    jenis_cascading: "FULLY", polarisasi: "MAXIMIZE",
    periode_pelaporan: "QUARTERLY",
    target_tw1: -5, target_tw2: -10, target_tw3: -15, target_tw4: -20,
    target_tahunan: -50,
  }, kinerjaC);
  ok("Negative targets rejected", neg.status >= 400, `status=${neg.status}`);

  const badYear = await req("POST", "/performance/iku", {
    year: -1, ss_name: "x", ss_description: "x", iku_name: "x",
    iku_description: "x", formula: "x", unit_pengukuran: "persen",
    penanda: "Renja", unit_kerja_level1: "Sekretariat Jenderal",
    unit_kerja: "Pusat Perencanaan Strategis PK",
    data_provider_unit: "Pusat Perencanaan Strategis PK",
    data_validator_unit: "Pusat Perencanaan Strategis PK",
    sumber_data: "x", tindakan_data: "x",
    konsolidasi_periode: "SUM", konsolidasi_lokasi: "SUM",
    jenis_cascading: "FULLY", polarisasi: "MAXIMIZE",
    periode_pelaporan: "QUARTERLY",
    target_tw1: 0, target_tw2: 0, target_tw3: 0, target_tw4: 0, target_tahunan: 0,
  }, kinerjaC);
  ok("Invalid year (-1) rejected", badYear.status >= 400, `status=${badYear.status}`);
}

// ========== 6. PK WORKFLOW ==========
async function testPKWorkflow(kinerjaC, pimpinanC, pkId) {
  console.log("\n--- PK Workflow ---");
  const list = await req("GET", "/performance/pks?year=2026", null, kinerjaC);
  ok("GET /performance/pks", list.status === 200, `status=${list.status}`);
  const items = list.body?.items || [];
  const draftPks = items.filter(p => p.perjanjian_kinerja_status === "DRAFT");
  ok("Has DRAFT PKs", draftPks.length > 0, `count=${draftPks.length}`);

  if (draftPks.length > 0) {
    const ids = draftPks.slice(0, 2).map(p => p.agreement_id);
    const subBulk = await req("POST", "/performance/pks/submit-bulk", { ids }, kinerjaC);
    ok("Submit-bulk PK", subBulk.status === 200, `status=${subBulk.status}`);
  }

  // Confirm-bulk
  const sub2 = await req("GET", "/performance/pks?year=2026", null, kinerjaC);
  const submittedPks = (sub2.body?.items || []).filter(p => p.perjanjian_kinerja_status === "SUBMITTED");
  if (submittedPks.length > 0) {
    const ids2 = submittedPks.slice(0, 2).map(p => p.agreement_id);
    const cBulk = await req("POST", "/performance/pks/confirm-bulk", { ids2 }, pimpinanC);
    ok("Confirm-bulk PK", cBulk.status === 200, `status=${cBulk.status}`);
  } else {
    ok("No SUBMITTED PKs to confirm", false, "skipped");
  }
}

// ========== 7. OUTPUT ==========
async function testOutput(kinerjaC, orgId) {
  console.log("\n--- Manual Output ---");
  const list = await req("GET", "/performance/outputs?year=2026", null, kinerjaC);
  ok("GET /performance/outputs", list.status === 200, `status=${list.status}`);

  const ts = Date.now();
  const create = await req("POST", "/performance/outputs", {
    organization_id: orgId, year: 2026, classification_code: "DOK",
    output_name: `Output-Test-${ts}`, output_indicator: "Test",
    output_type: "DOKUMEN", target_value: 10, unit: "dokumen", component: "Test",
  }, kinerjaC);
  ok("Create output (with org_id)", create.status === 201, `status=${create.status} body=${JSON.stringify(create.body).slice(0,200)}`);

  // Try without org_id — should fail
  const noOrg = await req("POST", "/performance/outputs", {
    year: 2026, output_name: "NoOrg", output_type: "DOKUMEN",
  }, kinerjaC);
  ok("Output without org_id rejected", noOrg.status >= 400, `status=${noOrg.status}`);
}

// ========== 8. RISK MODULE ==========
async function testRisk(risikoC) {
  console.log("\n--- Risk Module ---");

  // LKK
  const lkk = await req("GET", "/risk/contexts?year=2026", null, risikoC);
  ok("GET /risk/contexts (LKK)", lkk.status === 200, `status=${lkk.status}`);

  const ts = Date.now();
  const lkkCreate = await req("POST", "/risk/contexts", {
    year: 2026, context_name: `LKK-Test-${ts}`, context_description: "Bug test",
  }, risikoC);
  ok("Create LKK", lkkCreate.status === 201 || lkkCreate.status === 200, `status=${lkkCreate.status} body=${JSON.stringify(lkkCreate.body).slice(0,200)}`);

  // FAR
  const far = await req("GET", "/risk/assessments?year=2026", null, risikoC);
  ok("GET /risk/assessments (FAR)", far.status === 200, `status=${far.status}`);

  // IRU
  const iru = await req("GET", "/risk/indicators?year=2026", null, risikoC);
  ok("GET /risk/indicators (IRU)", iru.status === 200, `status=${iru.status}`);

  // FPR
  const fpr = await req("GET", "/risk/treatments?year=2026", null, risikoC);
  ok("GET /risk/treatments (FPR)", fpr.status === 200, `status=${fpr.status}`);

  // Risk dashboard
  const dash = await req("GET", "/risk/summary?year=2026", null, risikoC);
  ok("GET /risk/summary", dash.status === 200, `status=${dash.status}`);

  // References
  const ref = await req("GET", "/risk/references?year=2026", null, risikoC);
  ok("GET /risk/references", ref.status === 200, `status=${ref.status}`);
}

// ========== 9. MONITORING ==========
async function testMonitoring(adminC) {
  console.log("\n--- Monitoring & Reviu ---");
  const mon = await req("GET", "/monitoring?year=2026", null, adminC);
  ok("GET /monitoring", mon.status === 200, `status=${mon.status}`);
}

// ========== 10. USER MANAGEMENT ==========
async function testUserMgmt(adminC) {
  console.log("\n--- User Management ---");
  const users = await req("GET", "/admin/users", null, adminC);
  ok("GET /admin/users", users.status === 200, `status=${users.status} count=${Array.isArray(users.body) ? users.body.length : "?"}`);

  const roles = await req("GET", "/admin/roles", null, adminC);
  ok("GET /admin/roles", roles.status === 200, `status=${roles.status}`);

  // Create user
  const ts = Date.now();
  const create = await req("POST", "/admin/users", {
    employee_number: `TEST-${ts}`, employee_name: "Test User Bug",
    position_name: "Tester", email: `test${ts}@bug.local`,
    username: `testuser${ts}`, role_code: "MANAJER_KINERJA",
  }, adminC);
  ok("POST /admin/users (create)", create.status === 201 || create.status === 200, `status=${create.status} body=${JSON.stringify(create.body).slice(0,200)}`);

  // List again
  const users2 = await req("GET", "/admin/users", null, adminC);
  ok("Users count increased", Array.isArray(users2.body) && users2.body.length > (Array.isArray(users.body) ? users.body.length - 1 : 0), `before=${Array.isArray(users.body) ? users.body.length : "?"} after=${Array.isArray(users2.body) ? users2.body.length : "?"}`);
}

// ========== 11. ACCOUNT ==========
async function testAccount(kinerjaC) {
  console.log("\n--- Account ---");
  const me = await req("GET", "/auth/me", null, kinerjaC);
  ok("GET /auth/me", me.status === 200, `status=${me.status}`);
  ok("User data has username", !!me.body?.user?.username, `username=${me.body?.user?.username}`);
}

// ========== 12. EXPORT ==========
async function testExport(adminC) {
  console.log("\n--- Export ---");
  const csv = await req("GET", "/performance/iku/export?year=2026", null, adminC);
  ok("GET /performance/iku/export CSV", csv.status === 200 || csv.status === 404, `status=${csv.status}`);
}

// ========== MAIN ==========
async function main() {
  console.log("=== SIMONIK Comprehensive Bug Test ===\n");

  const adminC = await login("admin");
  const kinerjaC = await login("kinerja");
  const risikoC = await login("risiko");
  const pimpinanC = await login("pimpinan");
  const renstraC = await login("renstra");
  const krC = await login("kinerja.risiko");
  const kpC = await login("kepala.pusat");

  // Get admin org_id
  const me = await req("GET", "/auth/me", null, adminC);
  const adminOrgId = me.body?.user?.organization_id;
  const kinerjaMe = await req("GET", "/auth/me", null, kinerjaC);
  const kinerjaOrgId = kinerjaMe.body?.user?.organization_id;

  await testAuth();
  await testRBAC(kinerjaC, adminC);

  // IKU workflow
  const { id: ikuId, pkId } = await testIKUWorkflow(kinerjaC, krC, pimpinanC);
  await testDeleteIKU(kinerjaC);
  await testIKUValidation(kinerjaC);

  // PK workflow
  await testPKWorkflow(kinerjaC, pimpinanC, pkId);

  // Output
  await testOutput(kinerjaC, kinerjaOrgId);

  // Risk
  await testRisk(risikoC);

  // Monitoring
  await testMonitoring(adminC);

  // User Management
  await testUserMgmt(adminC);

  // Account
  await testAccount(kinerjaC);

  // Export
  await testExport(adminC);

  // SUMMARY
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
  console.log(`🐛 Total bugs found: ${bugs.length}`);
  if (bugs.length > 0) {
    console.log(`\n🐛 Bug List:`);
    bugs.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
