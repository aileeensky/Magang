require('dotenv').config();
const express=require('express');const cors=require('cors');const crypto=require('crypto');const {Pool}=require('pg');
const app=express();app.use(cors({origin:process.env.CORS_ORIGIN||'*'}));app.use(express.json({limit:'2mb'}));
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const q=(text,params)=>pool.query(text,params);
const SESSION_TTL_MS=8*60*60*1000;

// Runtime guard: login/session must remain available even when an older
// database was partially migrated. The full database is still created by
// DB/001_initial_schema.sql; this only guarantees the session table exists.
async function ensureRuntimeSchema(){
  await q('create schema if not exists system');
  await q(`create table if not exists system.user_session (
    session_id varchar(128) primary key,
    user_id uuid not null references master.app_user(user_id) on delete cascade,
    expires_at timestamptz not null,
    data jsonb not null,
    created_at timestamptz not null default now()
  )`);
  await q('create index if not exists idx_user_session_expires_at on system.user_session(expires_at)');
  await q('create index if not exists idx_user_session_user_id on system.user_session(user_id)');
  // Revisi 08/09/2026: safe runtime guards for databases where migration 010
  // belum dijalankan. Migration 010 tetap menjadi source of truth untuk deployment.
  // Status field names are intentionally domain-specific to avoid collisions between Manual IKU and PK.
  await q(`alter table performance.iku_manual rename column status to manual_iku_status` ).catch(()=>{});
  await q(`alter table performance.performance_agreement rename column status to perjanjian_kinerja_status` ).catch(()=>{});
  await q(`alter table performance.iku_manual
    add column if not exists renja_type varchar(20),
    add column if not exists target_annual numeric(20,6),
    add column if not exists bidang_validation_status varchar(20) not null default 'PENDING',
    add column if not exists bidang_rejection_reason text,
    add column if not exists pimpinan_validation_status varchar(20) not null default 'PENDING',
    add column if not exists pimpinan_rejection_reason text,
    add column if not exists active boolean not null default true`);
  await q(`alter table performance.iku_manual drop constraint if exists iku_manual_status_check`);
  await q(`alter table performance.iku_manual add constraint iku_manual_status_check check (manual_iku_status in ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'))`);
  await q(`alter table performance.performance_agreement
    add column if not exists bidang_validation_status varchar(20) not null default 'PENDING',
    add column if not exists bidang_rejection_reason text,
    add column if not exists pimpinan_validation_status varchar(20) not null default 'PENDING',
    add column if not exists pimpinan_rejection_reason text,
    add column if not exists active boolean not null default true`);
  await q(`alter table performance.performance_agreement drop constraint if exists performance_agreement_status_check`);
  await q(`update performance.performance_agreement set perjanjian_kinerja_status='REVIEWED' where perjanjian_kinerja_status='REVIEW'`);
  await q(`alter table performance.performance_agreement add constraint performance_agreement_status_check check (perjanjian_kinerja_status in ('DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED'))`);
  await q(`alter table risk.risk_context
    add column if not exists submitted_at timestamptz,
    add column if not exists selected_for_submission boolean not null default false,
    add column if not exists rejection_reason text,
    add column if not exists output_detail text,
    add column if not exists business_process_detail text`);
}
function hashPassword(password,salt){return crypto.pbkdf2Sync(password,salt,120000,32,'sha256').toString('hex')}
function verifyPassword(password,stored){try{const [salt,hash]=String(stored||'').split('$');if(!salt||!hash)return false;const expected=hashPassword(password,salt);return crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(expected))}catch{return false}}
function normalizedRoleCodes(user){return new Set((user?.roles||[]).map(r=>String(r.role_code||'').trim().toUpperCase().replace(/[\s-]+/g,'_')))}
function isSuperAdmin(user){const roles=user?.roles||[];return normalizedRoleCodes(user).has('SUPER_ADMIN')||roles.some(r=>String(r.role_name||'').trim().toLowerCase()==='super admin')}
function parseCookies(header=''){return Object.fromEntries(header.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}))}
function setSessionCookie(res,id){res.setHeader('Set-Cookie',`simonik_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS/1000)}`)}
function clearSessionCookie(res){res.setHeader('Set-Cookie','simonik_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')}
async function createSession(user){const id=crypto.randomBytes(32).toString('hex');const expires=new Date(Date.now()+SESSION_TTL_MS);await q('insert into system.user_session(session_id,user_id,expires_at,data) values($1,$2,$3,$4)',[id,user.user_id,expires,JSON.stringify(user)]);return id}
async function getSessionUser(id){if(!id)return null;const r=await q('select user_id,data,expires_at from system.user_session where session_id=$1',[id]);const row=r.rows[0];if(!row)return null;if(new Date(row.expires_at).getTime()<=Date.now()){await q('delete from system.user_session where session_id=$1',[id]);return null}await q('update system.user_session set expires_at=$2 where session_id=$1',[id,new Date(Date.now()+SESSION_TTL_MS)]);return row.data}
async function destroySession(id){if(id)await q('delete from system.user_session where session_id=$1',[id])}
async function auth(req,res,next){if(req.path==='/api/health'||req.path==='/api/auth/login')return next();try{const cookies=parseCookies(req.headers.cookie||'');const sessionId=cookies.simonik_session;const user=await getSessionUser(sessionId);if(!user){clearSessionCookie(res);return res.status(401).json({message:'Sesi tidak valid atau sudah berakhir'})}req.user=user;req.sessionId=sessionId;const codes=normalizedRoleCodes(user);const allowed=(prefix,roles)=>{if(!req.path.startsWith(prefix)||isSuperAdmin(user))return true;return roles.some(r=>codes.has(r))};if(!allowed('/api/performance',['MANAJER_KINERJA','PIMPINAN_UNIT','KEPALA_PUSAT_PPSPK','BIDANG_RENSTRA','BIDANG_KINERJA_RISIKO'])||!allowed('/api/risk',['MANAJER_RISIKO','PIMPINAN_UNIT','KEPALA_PUSAT_PPSPK','BIDANG_KINERJA_RISIKO'])||!allowed('/api/monitoring',['MANAJER_RISIKO','PIMPINAN_UNIT','KEPALA_PUSAT_PPSPK','BIDANG_KINERJA_RISIKO']))return res.status(403).json({message:'Anda tidak memiliki kewenangan untuk modul ini'});next()}catch(e){res.status(500).json({message:e.message})}}
app.use(auth);
app.get('/api/health',async(_,res)=>{try{await q('select 1');res.json({status:'ok',service:'simonik-be'})}catch(e){res.status(503).json({status:'error',message:e.message})}});
app.post('/api/auth/login',async(req,res)=>{const {username,password}=req.body||{};if(!username||!password)return res.status(400).json({message:'Username dan password wajib diisi'});try{const r=await q(`select u.user_id,u.username,u.password_hash,u.employee_id,e.employee_name,e.position_name,e.organization_id,o.organization_name,coalesce(json_agg(json_build_object('role_code',ro.role_code,'role_name',ro.role_name,'organization_id',ur.organization_id)) filter (where ro.role_id is not null),'[]') roles from master.app_user u join master.employee e on e.employee_id=u.employee_id join master.organization o on o.organization_id=e.organization_id left join master.user_role ur on ur.user_id=u.user_id left join master.role ro on ro.role_id=ur.role_id where lower(u.username)=lower($1) and u.is_active=true group by u.user_id,e.employee_name,e.position_name,e.organization_id,o.organization_name`,[username]);const row=r.rows[0];if(!row||!verifyPassword(password,row.password_hash))return res.status(401).json({message:'Username atau password salah'});const {password_hash,...user}=row;const sessionId=await createSession(user);setSessionCookie(res,sessionId);res.json({user})}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/auth/me',async(req,res)=>{res.json({user:req.user})});
app.post('/api/auth/logout',async(req,res)=>{try{const cookies=parseCookies(req.headers.cookie||'');await destroySession(cookies.simonik_session);clearSessionCookie(res);res.json({message:'Logout berhasil'})}catch(e){res.status(500).json({message:e.message})}});
app.put('/api/auth/password',async(req,res)=>{const {current_password,new_password}=req.body||{};if(!current_password||!new_password)return res.status(400).json({message:'Password lama dan password baru wajib diisi'});if(String(new_password).length<8)return res.status(400).json({message:'Password baru minimal 8 karakter'});try{const r=await q('select password_hash from master.app_user where user_id=$1 and is_active=true',[req.user.user_id]);if(!r.rows[0]||!verifyPassword(current_password,r.rows[0].password_hash))return res.status(400).json({message:'Password lama tidak sesuai'});const salt=crypto.randomBytes(16).toString('hex');const stored=`${salt}$${hashPassword(String(new_password),salt)}`;await q('update master.app_user set password_hash=$1 where user_id=$2',[stored,req.user.user_id]);res.json({message:'Password berhasil diperbarui'})}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/admin/roles',async(req,res)=>{
 if(!isSuperAdmin(req.user))return res.status(403).json({message:'Hanya Super Admin yang dapat mengelola akun pengguna'});
 try{res.json((await q(`select role_id,role_code,role_name,description from master.role order by role_name`)).rows)}catch(e){res.status(500).json({message:e.message})}
});
app.get('/api/admin/users',async(req,res)=>{
 if(!isSuperAdmin(req.user))return res.status(403).json({message:'Hanya Super Admin yang dapat mengelola akun pengguna'});
 try{res.json((await q(`select u.user_id,u.username,u.is_active,e.employee_id,e.employee_number,e.employee_name,e.position_name,e.email,e.organization_id,o.organization_name,
 coalesce(json_agg(json_build_object('role_id',r.role_id,'role_code',r.role_code,'role_name',r.role_name,'organization_id',ur.organization_id)) filter(where r.role_id is not null),'[]') roles
 from master.app_user u join master.employee e on e.employee_id=u.employee_id join master.organization o on o.organization_id=e.organization_id
 left join master.user_role ur on ur.user_id=u.user_id left join master.role r on r.role_id=ur.role_id
 group by u.user_id,e.employee_id,e.employee_number,e.employee_name,e.position_name,e.email,e.organization_id,o.organization_name order by e.employee_name`)).rows)}catch(e){res.status(500).json({message:e.message})}
});
app.post('/api/admin/users',async(req,res)=>{
 if(!isSuperAdmin(req.user))return res.status(403).json({message:'Hanya Super Admin yang dapat mengelola akun pengguna'});
 const b=req.body||{}; const required=['username','password','employee_number','employee_name','organization_id'];
 if(required.some(k=>!String(b[k]||'').trim()))return res.status(400).json({message:'Username, password, NIP/nomor pegawai, nama, dan unit kerja wajib diisi'});
 if(String(b.password).length<8)return res.status(400).json({message:'Password minimal 8 karakter'});
 const roles=Array.isArray(b.roles)?b.roles:[]; if(!roles.length)return res.status(400).json({message:'Pilih minimal satu role'});
 const client=await pool.connect(); try{await client.query('BEGIN');
  const exists=await client.query('select 1 from master.app_user where lower(username)=lower($1) union all select 1 from master.employee where employee_number=$2 limit 1',[String(b.username).trim(),String(b.employee_number).trim()]);
  if(exists.rowCount)throw new Error('Username atau nomor pegawai sudah digunakan');
  const employee=(await client.query(`insert into master.employee(organization_id,employee_number,employee_name,position_name,email) values($1,$2,$3,$4,$5) returning employee_id`,[b.organization_id,String(b.employee_number).trim(),String(b.employee_name).trim(),b.position_name||null,b.email||null])).rows[0];
  const salt=crypto.randomBytes(16).toString('hex'); const hash=hashPassword(String(b.password),salt); const stored=`${salt}$${hash}`;
  const user=(await client.query(`insert into master.app_user(employee_id,username,password_hash,is_active) values($1,$2,$3,$4) returning user_id,username,is_active`,[employee.employee_id,String(b.username).trim(),stored,b.is_active!==false])).rows[0];
  for(const role of roles){const roleId=String(role.role_id||''); if(!roleId)continue; await client.query(`insert into master.user_role(user_id,role_id,organization_id) values($1,$2,$3)`,[user.user_id,roleId,b.organization_id]);}
  await client.query('COMMIT'); res.status(201).json({message:'Akun berhasil dibuat',user_id:user.user_id});
 }catch(e){await client.query('ROLLBACK');res.status(400).json({message:e.message})}finally{client.release()}
});
app.put('/api/admin/users/:id',async(req,res)=>{
 if(!isSuperAdmin(req.user))return res.status(403).json({message:'Hanya Super Admin yang dapat mengelola akun pengguna'});
 const b=req.body||{}; const roles=Array.isArray(b.roles)?b.roles:[]; if(!String(b.username||'').trim()||!String(b.employee_number||'').trim()||!String(b.employee_name||'').trim()||!b.organization_id)return res.status(400).json({message:'Data akun belum lengkap'}); if(!roles.length)return res.status(400).json({message:'Pilih minimal satu role'}); if(b.password && String(b.password).length<8)return res.status(400).json({message:'Password minimal 8 karakter'});
 const client=await pool.connect(); try{await client.query('BEGIN');
  const current=(await client.query(`select u.user_id,u.employee_id from master.app_user u where u.user_id=$1`,[req.params.id])).rows[0]; if(!current)throw new Error('Akun tidak ditemukan');
  const dup=await client.query(`select 1 from master.app_user where lower(username)=lower($1) and user_id<>$2 union all select 1 from master.employee where employee_number=$3 and employee_id<>$4 limit 1`,[String(b.username).trim(),req.params.id,String(b.employee_number).trim(),current.employee_id]); if(dup.rowCount)throw new Error('Username atau nomor pegawai sudah digunakan');
  await client.query(`update master.employee set organization_id=$1,employee_number=$2,employee_name=$3,position_name=$4,email=$5,is_active=$6 where employee_id=$7`,[b.organization_id,String(b.employee_number).trim(),String(b.employee_name).trim(),b.position_name||null,b.email||null,b.is_active!==false,current.employee_id]);
  if(b.password){const salt=crypto.randomBytes(16).toString('hex');const stored=`${salt}$${hashPassword(String(b.password),salt)}`;await client.query(`update master.app_user set username=$1,password_hash=$2,is_active=$3 where user_id=$4`,[String(b.username).trim(),stored,b.is_active!==false,req.params.id])}else await client.query(`update master.app_user set username=$1,is_active=$2 where user_id=$3`,[String(b.username).trim(),b.is_active!==false,req.params.id]);
  await client.query(`delete from master.user_role where user_id=$1`,[req.params.id]); for(const role of roles){if(role.role_id)await client.query(`insert into master.user_role(user_id,role_id,organization_id) values($1,$2,$3)`,[req.params.id,role.role_id,b.organization_id]);}
  await client.query('COMMIT');res.json({message:'Akun berhasil diperbarui'});
 }catch(e){await client.query('ROLLBACK');res.status(400).json({message:e.message})}finally{client.release()}
});
app.get('/api/master/organizations',async(_,res)=>{try{res.json((await q("select organization_id,organization_name,parent_id,organization_level,is_active from master.organization where is_active=true order by organization_name")).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/strategic-objectives',async(_,res)=>{try{res.json((await q("select strategic_objective_id,code,name from planning.strategic_objective order by code nulls last,name")).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/risk-categories',async(_,res)=>{try{res.json((await q("select risk_category_id,code,name from master.risk_category where is_active=true order by name")).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/business-processes',async(_,res)=>{try{res.json((await q(`select business_process_id,code,name,level from master.business_process where is_active=true order by level nulls last,code,name`)).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/activity-objectives',async(_,res)=>{try{res.json((await q(`select activity_objective_id,code,name,description from planning.activity_objective order by code nulls last,name`)).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/activity-indicators',async(req,res)=>{try{const objective=req.query.activity_objective_id||null;res.json((await q(`select activity_indicator_id,activity_objective_id,indicator_code,indicator_name,target_value,unit from planning.activity_indicator where ($1::uuid is null or activity_objective_id=$1) order by indicator_code nulls last,indicator_name`,[objective])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/outputs',async(_,res)=>{try{res.json((await q(`select output_id,code,name,target_value,unit from planning.output order by code nulls last,name`)).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/master/employees',async(req,res)=>{try{const org=req.query.organization_id||null;res.json((await q(`select e.employee_id,e.employee_number,e.employee_name,e.position_name,e.organization_id,o.organization_name from master.employee e join master.organization o on o.organization_id=e.organization_id where e.is_active=true and ($1::uuid is null or e.organization_id=$1) order by e.employee_name`,[org])).rows)}catch(e){res.status(500).json({message:e.message})}});

// =========================
// PERFORMANCE / MANAJEMEN KINERJA
// =========================
app.get('/api/performance/iku',async(req,res)=>{
 try{
  const codes=normalizedRoleCodes(req.user);
  const admin=isSuperAdmin(req.user);
  const manager=codes.has('MANAJER_KINERJA');
  const bidangRisk=codes.has('BIDANG_KINERJA_RISIKO');
  const bidangRenstra=codes.has('BIDANG_RENSTRA');
  const pusat=codes.has('KEPALA_PUSAT_PPSPK');
  const leader=codes.has('PIMPINAN_UNIT');
  const r=await q(`
   select i.*,o.organization_name,
          coalesce(dp.organization_name,'') data_provider_org_name,
          coalesce(dv.organization_name,'') data_validator_org_name,
          coalesce(so.code,'') strategic_objective_code,
          coalesce(so.name,i.strategic_objective_name,'') strategic_objective_display
   from performance.iku_manual i
   left join master.organization o on o.organization_id=i.organization_id
   left join master.organization dp on dp.organization_id=i.data_provider_org_id
   left join master.organization dv on dv.organization_id=i.data_validator_org_id
   left join planning.strategic_objective so on so.strategic_objective_id=i.strategic_objective_id
   where i.active=true
     and (
       $1::boolean
       or ($2::boolean and i.organization_id=$3::uuid)
       or ($4::boolean and i.manual_iku_status in ('SUBMITTED','REVIEWED'))
       or ($5::boolean and i.active=true and i.manual_iku_status<>'DRAFT')
       or ($6::boolean and i.organization_id=$3::uuid and (
            (i.manual_iku_status in ('REVIEWED','APPROVED') and i.bidang_validation_status='APPROVED')
            or (i.manual_iku_status='REJECTED' and i.pimpinan_validation_status='REJECTED')
          ))
     )
   order by i.year desc,i.created_at desc
  `,[admin,manager,req.user.organization_id,bidangRisk,bidangRenstra||pusat,leader]);
  res.json(r.rows);
 }catch(e){console.error('Get Manual IKU error:',e);res.status(500).json({message:e.message})}
});
app.post('/api/performance/iku',async(req,res)=>{
 const b=req.body||{};
 const organizationId=b.organization_id||req.user?.organization_id||null;
 if(!organizationId)return res.status(400).json({message:'Unit kerja belum terhubung dengan pengguna.',code:'ORG_REQUIRED'});
const codes=normalizedRoleCodes(req.user);
  if(!isSuperAdmin(req.user)&&!codes.has('MANAJER_KINERJA'))return res.status(403).json({message:'Hanya Manajer Kinerja yang dapat membuat Manual IKU.'});
  if(!String(b.indicator_name||'').trim())return res.status(400).json({message:'Nama indikator (IKU) wajib diisi.',code:'IKU_NAME_REQUIRED'});
  const yearNum=Number(b.year);
  if(!Number.isInteger(yearNum)||yearNum<1900||yearNum>2200)return res.status(400).json({message:'Tahun harus berupa angka antara 1900 dan 2200.',code:'IKU_YEAR_INVALID'});
  for(const v of [b.target_tw1,b.target_tw2,b.target_tw3,b.target_tw4]){
   if(v===''||v===null||v===undefined)continue;
   const n=Number(v);
   if(!Number.isFinite(n)||n<0)return res.status(400).json({message:'Target triwulan tidak boleh negatif.',code:'IKU_TARGET_INVALID'});
  }
  const cleanUuid=(v)=>{
   const s=String(v??'').trim();
   return s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)?s:null;
 };
 const cleanNumber=(v)=>{
   if(v===''||v===null||v===undefined)return null;
   const n=Number(v);
   return Number.isFinite(n)?n:null;
 };
 const strategicId=cleanUuid(b.strategic_objective_id);
 const providerId=cleanUuid(b.data_provider_org_id)||cleanUuid(organizationId);
 const validatorId=cleanUuid(b.data_validator_org_id)||cleanUuid(organizationId);
 const year=Number(b.year);
 const safeYear=Number.isInteger(year)&&year>=1900&&year<=2200?year:new Date().getFullYear();
 const tw1=cleanNumber(b.target_tw1),tw2=cleanNumber(b.target_tw2),tw3=cleanNumber(b.target_tw3),tw4=cleanNumber(b.target_tw4);
 const mode=['SUM','AVERAGE','TAKE_LAST_KNOWN'].includes(String(b.period_consolidation||''))?String(b.period_consolidation):'SUM';
 const annual=mode==='SUM'
   ?[tw1,tw2,tw3,tw4].reduce((a,v)=>a+(v??0),0)
   :mode==='AVERAGE'
     ?[tw1,tw2,tw3,tw4].reduce((a,v)=>a+(v??0),0)/4
     :tw4;
 const strategicName=String(b.strategic_objective_name||b.strategic_objective_text||'').trim()||null;
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  let finalStrategicId=strategicId;
  let finalStrategicName=strategicName;
  if(finalStrategicId){
    const s=await client.query(`select name from planning.strategic_objective where strategic_objective_id=$1`,[finalStrategicId]);
    if(!s.rows[0]){
      await client.query('ROLLBACK');
      return res.status(400).json({message:'Sasaran Strategis tidak ditemukan.',code:'STRATEGIC_OBJECTIVE_NOT_FOUND'});
    }
    finalStrategicName=s.rows[0].name;
  }else if(finalStrategicName){
    // Jika user mengetik Sasaran Strategis yang belum ada di master,
    // buat/reuse record master terlebih dahulu agar Manual IKU selalu
    // memiliki strategic_objective_id yang canonical.
    const existing=await client.query(
      `select strategic_objective_id,name from planning.strategic_objective
       where lower(trim(name))=lower(trim($1))
       order by strategic_objective_id limit 1`,
      [finalStrategicName]
    );
    if(existing.rows[0]){
      finalStrategicId=existing.rows[0].strategic_objective_id;
      finalStrategicName=existing.rows[0].name;
    }else{
      const created=await client.query(
        `insert into planning.strategic_objective(name,description)
         values($1,$2) returning strategic_objective_id,name`,
        [finalStrategicName,b.strategic_objective_description||null]
      );
      finalStrategicId=created.rows[0].strategic_objective_id;
      finalStrategicName=created.rows[0].name;
    }
  }
  const r=await client.query(`insert into performance.iku_manual
   (organization_id,year,renja_type,strategic_objective_id,strategic_objective_name,strategic_objective_description,indicator_name,indicator_description,formula,measurement_unit,data_provider_org_id,data_source,data_validator_org_id,missing_data_action,period_consolidation,cascading_type,location_consolidation,polarization,reporting_period,target_tw1,target_tw2,target_tw3,target_tw4,target_annual,manual_iku_status,bidang_validation_status,pimpinan_validation_status,active)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'DRAFT','PENDING','PENDING',true) returning *`,
   [organizationId,safeYear,['RENJA','NON_RENJA'].includes(String(b.renja_type||''))?String(b.renja_type):null,finalStrategicId,finalStrategicName,b.strategic_objective_description||null,String(b.indicator_name||'').trim()||'(Draft)',b.indicator_description||null,b.formula||null,b.measurement_unit||null,providerId,b.data_source||null,validatorId,b.missing_data_action||null,mode,['FULLY','PARTIALLY','NON_DIRECT'].includes(String(b.cascading_type||''))?String(b.cascading_type):'FULLY',['SUM','AVERAGE','RAW_DATA'].includes(String(b.location_consolidation||''))?String(b.location_consolidation):'SUM',['MAXIMIZE','STABILIZE','MINIMIZE'].includes(String(b.polarization||''))?String(b.polarization):'MAXIMIZE',['MONTHLY','QUARTERLY','SEMESTERLY','YEARLY'].includes(String(b.reporting_period||''))?String(b.reporting_period):'QUARTERLY',tw1,tw2,tw3,tw4,annual]);
  await client.query('COMMIT');
  return res.status(201).json(r.rows[0]);
 }catch(e){
  try{await client.query('ROLLBACK')}catch{}
  console.error('POST /api/performance/iku error:',{message:e.message,code:e.code,detail:e.detail,table:e.table,column:e.column,constraint:e.constraint});
  return res.status(400).json({message:e.detail?`${e.message}: ${e.detail}`:e.message,code:e.code||'IKU_CREATE_ERROR',constraint:e.constraint||null});
 }finally{client.release()}
});
app.put('/api/performance/iku/:id',async(req,res)=>{
 const b=req.body||{}; const client=await pool.connect();
 try{
  const old=(await client.query(`select * from performance.iku_manual where iku_id=$1`,[req.params.id])).rows[0];
  if(!old)return res.status(404).json({message:'Manual IKU tidak ditemukan'});
  const codes=normalizedRoleCodes(req.user);
  if(!isSuperAdmin(req.user)&&(!codes.has('MANAJER_KINERJA')||old.organization_id!==req.user.organization_id||!old.active))return res.status(403).json({message:'Manual IKU tidak dapat diedit.'});
  if(!['APPROVED','REJECTED','DRAFT'].includes(old.manual_iku_status))return res.status(409).json({message:'Manual IKU belum berada pada status yang dapat diedit.'});
  if(old.pending_action && old.pending_action!=='NONE')return res.status(409).json({message:'Manual IKU sedang dalam proses perubahan/penghapusan.'});
  const mode=b.period_consolidation||old.period_consolidation;
  const vals=[b.target_tw1,b.target_tw2,b.target_tw3,b.target_tw4].map(v=>v===''||v===null||v===undefined?null:Number(v));
  const annual=mode==='SUM'?vals.reduce((a,v)=>a+(Number.isFinite(v)?v:0),0):mode==='AVERAGE'?vals.reduce((a,v)=>a+(Number.isFinite(v)?v:0),0)/4:vals[3];
  const approvedEdit=old.manual_iku_status==='APPROVED';
  let strategicId=b.strategic_objective_id||null;
  let strategicName=String(b.strategic_objective_name||b.strategic_objective_text||'').trim()||null;
  await client.query('BEGIN');
  if(strategicId){
    const s=await client.query(`select name from planning.strategic_objective where strategic_objective_id=$1`,[strategicId]);
    if(!s.rows[0])throw new Error('Sasaran Strategis tidak ditemukan.');
    strategicName=s.rows[0].name;
  }else if(strategicName){
    const existing=await client.query(
      `select strategic_objective_id,name from planning.strategic_objective
       where lower(trim(name))=lower(trim($1))
       order by strategic_objective_id limit 1`,[strategicName]
    );
    if(existing.rows[0]){
      strategicId=existing.rows[0].strategic_objective_id;
      strategicName=existing.rows[0].name;
    }else{
      const created=await client.query(
        `insert into planning.strategic_objective(name,description) values($1,$2)
         returning strategic_objective_id,name`,[strategicName,b.strategic_objective_description||null]
      );
      strategicId=created.rows[0].strategic_objective_id;
      strategicName=created.rows[0].name;
    }
  }
  const r=await client.query(`update performance.iku_manual set renja_type=$1,strategic_objective_id=$2,strategic_objective_name=$3,strategic_objective_description=$4,indicator_name=$5,indicator_description=$6,formula=$7,measurement_unit=$8,data_provider_org_id=$9,data_source=$10,data_validator_org_id=$11,missing_data_action=$12,period_consolidation=$13,cascading_type=$14,location_consolidation=$15,polarization=$16,reporting_period=$17,target_tw1=$18,target_tw2=$19,target_tw3=$20,target_tw4=$21,target_annual=$22,manual_iku_status=$23,pending_action=$24,bidang_validation_status='PENDING',bidang_rejection_reason=null,pimpinan_validation_status='PENDING',pimpinan_rejection_reason=null,updated_at=now() where iku_id=$25 returning *`,
  [b.renja_type||old.renja_type,strategicId,strategicName,b.strategic_objective_description||null,b.indicator_name,b.indicator_description||null,b.formula||null,b.measurement_unit||null,b.data_provider_org_id||old.data_provider_org_id,b.data_source||null,b.data_validator_org_id||old.data_validator_org_id,b.missing_data_action||null,mode,b.cascading_type,b.location_consolidation,b.polarization,b.reporting_period,vals[0],vals[1],vals[2],vals[3],annual,approvedEdit?'SUBMITTED':'DRAFT',approvedEdit?'EDIT':'NONE',req.params.id]);
  await client.query('COMMIT');
  res.json(r.rows[0]);
 }catch(e){try{await client.query('ROLLBACK')}catch{} res.status(400).json({message:e.message})}finally{client.release()}
});
app.delete('/api/performance/iku/:id',async(req,res)=>{
 try{
  const old=(await q(`select * from performance.iku_manual where iku_id=$1 and active=true`,[req.params.id])).rows[0];
  const c=normalizedRoleCodes(req.user);
  if(!old)return res.status(404).json({message:'Manual IKU tidak ditemukan'});
  if(!isSuperAdmin(req.user)&&(!c.has('MANAJER_KINERJA')||old.organization_id!==req.user.organization_id))return res.status(403).json({message:'Tidak memiliki kewenangan menghapus Manual IKU.'});
  if(old.pending_action && old.pending_action!=='NONE')return res.status(409).json({message:'Manual IKU sedang dalam proses perubahan/penghapusan.'});
  if(old.manual_iku_status==='DRAFT'){
   const r=await q(`delete from performance.iku_manual where iku_id=$1 and manual_iku_status='DRAFT' returning *`,[req.params.id]);
   if(!r.rows[0])return res.status(409).json({message:'Manual IKU Draft tidak dapat dihapus.'});
   return res.json({deleted:true,iku_id:req.params.id});
  }
  if(old.manual_iku_status==='REJECTED'){
   const r=await q(`update performance.iku_manual set active=false,pending_action='NONE',updated_at=now() where iku_id=$1 returning *`,[req.params.id]);
   return res.json(r.rows[0]);
  }
  if(old.manual_iku_status!=='APPROVED')return res.status(409).json({message:'Manual IKU hanya dapat dihapus langsung saat Draft/Rejected, atau diajukan penghapusannya setelah Approved.'});
  const r=await q(`update performance.iku_manual set manual_iku_status='SUBMITTED',pending_action='DELETE',bidang_validation_status='PENDING',bidang_rejection_reason=null,pimpinan_validation_status='PENDING',pimpinan_rejection_reason=null,updated_at=now() where iku_id=$1 returning *`,[req.params.id]);
  res.json(r.rows[0]);
 }catch(e){res.status(400).json({message:e.message})}
});
app.post('/api/performance/iku/submit-bulk',async(req,res)=>{
 const ids=Array.isArray(req.body?.ids)?req.body.ids.map(x=>String(x).trim()).filter(Boolean):[];
 const c=normalizedRoleCodes(req.user);
 if(!isSuperAdmin(req.user)&&!c.has('MANAJER_KINERJA'))return res.status(403).json({message:'Hanya Manajer Kinerja yang dapat mengajukan Manual IKU.'});
 if(!ids.length)return res.status(400).json({message:'Pilih minimal satu Manual IKU untuk diajukan.'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const r=await client.query(`update performance.iku_manual set manual_iku_status='SUBMITTED',bidang_validation_status='PENDING',bidang_rejection_reason=null,updated_at=now() where iku_id=any($1::uuid[]) and active=true and organization_id=$2::uuid and manual_iku_status in ('DRAFT','REJECTED') returning iku_id`,[ids,req.user.organization_id]);
  if(r.rowCount!==ids.length){await client.query('ROLLBACK');return res.status(409).json({message:'Sebagian Manual IKU tidak dapat diajukan. Pastikan semua yang dipilih masih berstatus Draft/Rejected dan berasal dari unit Anda.',updated_ids:r.rows.map(x=>x.iku_id)});}
  await client.query('COMMIT');
  res.json({message:`${r.rowCount} Manual IKU berhasil diajukan.`,count:r.rowCount,ids:r.rows.map(x=>x.iku_id)});
 }catch(e){try{await client.query('ROLLBACK')}catch{};res.status(400).json({message:e.message})}finally{client.release()}
});
app.post('/api/performance/iku/:id/status',async(req,res)=>{
 const next=String(req.body.status||'').toUpperCase(),notes=String(req.body.notes||'').trim()||null;
 try{
  const old=(await q(`select * from performance.iku_manual where iku_id=$1 and active=true`,[req.params.id])).rows[0];
  if(!old)return res.status(404).json({message:'Manual IKU tidak ditemukan'});
  const c=normalizedRoleCodes(req.user);
  if(next==='SUBMITTED'){
   if(!isSuperAdmin(req.user)&&(!c.has('MANAJER_KINERJA')||old.organization_id!==req.user.organization_id||!['DRAFT','REJECTED'].includes(old.manual_iku_status)))return res.status(403).json({message:'Manual IKU tidak dapat diajukan.'});
   const r=await q(`update performance.iku_manual set manual_iku_status='SUBMITTED',pending_action='NONE',bidang_validation_status='PENDING',pimpinan_validation_status='PENDING',updated_at=now() where iku_id=$1 returning *`,[req.params.id]);return res.json(r.rows[0]);
  }
  if(next==='REVIEWED'||next==='REJECTED'){
   if(!isSuperAdmin(req.user)&&(!c.has('BIDANG_KINERJA_RISIKO')||old.manual_iku_status!=='SUBMITTED'||old.bidang_validation_status==='APPROVED'))return res.status(403).json({message:'Hanya Bidang Pengelolaan Kinerja dan Risiko yang dapat memvalidasi.'});
   if(next==='REJECTED'&&!notes)return res.status(400).json({message:'Alasan penolakan wajib diisi.'});
   const deleteFlow=old.pending_action==='DELETE';
   const nextStatus=next==='REVIEWED'?'REVIEWED':(deleteFlow?'APPROVED':'REJECTED');
   const r=await q(`update performance.iku_manual set manual_iku_status=$1,bidang_validation_status=$2,bidang_rejection_reason=$3,pimpinan_validation_status=$4,pimpinan_rejection_reason=null,pending_action=$5,updated_at=now() where iku_id=$6 returning *`,
     [nextStatus,next==='REVIEWED'?'APPROVED':'REJECTED',next==='REJECTED'?notes:null,'PENDING',deleteFlow&&next==='REVIEWED'?'DELETE':(deleteFlow?'NONE':old.pending_action||'NONE'),req.params.id]);
   return res.json(r.rows[0]);
  }
  if(next==='APPROVED'){
   if(!isSuperAdmin(req.user)&&(!c.has('PIMPINAN_UNIT')||old.manual_iku_status!=='REVIEWED'||old.bidang_validation_status!=='APPROVED'))return res.status(403).json({message:'Manual IKU belum siap divalidasi Pimpinan Unit.'});
   if(old.pending_action==='DELETE'){
    const r=await q(`update performance.iku_manual set active=false,manual_iku_status='APPROVED',pending_action='NONE',pimpinan_validation_status='APPROVED',updated_at=now() where iku_id=$1 returning *`,[req.params.id]);
    return res.json(r.rows[0]);
   }
const client=await pool.connect();
    try{
     await client.query('BEGIN');
     await client.query(`update performance.iku_manual set manual_iku_status='APPROVED',pending_action='NONE',pimpinan_validation_status='APPROVED',updated_at=now() where iku_id=$1`,[req.params.id]);
     await client.query(`insert into performance.performance_agreement(organization_id,year,strategic_objective_id,iku_id,target_tw1,target_tw2,target_tw3,target_tw4,perjanjian_kinerja_status,bidang_validation_status,pimpinan_validation_status)
      select organization_id,year,strategic_objective_id,iku_id,target_tw1,target_tw2,target_tw3,target_tw4,'DRAFT','PENDING','PENDING'
      from performance.iku_manual where iku_id=$1
      on conflict (organization_id,year,iku_id) do update set perjanjian_kinerja_status='DRAFT',bidang_validation_status='PENDING',pimpinan_validation_status='PENDING',active=true,updated_at=now()`,[req.params.id]);
     await client.query('COMMIT');
    }catch(e){
     try{await client.query('ROLLBACK')}catch{}
     throw e;
    }finally{client.release()}
    const r=await q(`select * from performance.iku_manual where iku_id=$1`,[req.params.id]);
    return res.json(r.rows[0]);
  }
  if(next==='PIMPINAN_REJECTED'){
   if(!isSuperAdmin(req.user)&&(!c.has('PIMPINAN_UNIT')||old.manual_iku_status!=='REVIEWED'))return res.status(403).json({message:'Tidak memiliki kewenangan.'});
   if(!notes)return res.status(400).json({message:'Alasan penolakan wajib diisi.'});
   const deleteFlow=old.pending_action==='DELETE';
   const r=await q(`update performance.iku_manual set manual_iku_status=$1,pimpinan_validation_status='REJECTED',pimpinan_rejection_reason=$2,pending_action='NONE',updated_at=now() where iku_id=$3 returning *`,
     [deleteFlow?'APPROVED':'REJECTED',notes,req.params.id]);
   return res.json(r.rows[0]);
  }
  return res.status(400).json({message:'Status tidak valid'});
 }catch(e){res.status(400).json({message:e.message})}
});

app.get('/api/performance/pks',async(req,res)=>{
 try{
  const c=normalizedRoleCodes(req.user);
  const wide=isSuperAdmin(req.user)||c.has('BIDANG_KINERJA_RISIKO')||c.has('KEPALA_PUSAT_PPSPK');
  let r;
  if(wide){
   r=await q(`select p.*,o.organization_name,o.organization_level,i.indicator_name,i.period_consolidation,i.measurement_unit,a.strategic_objective_name
     from performance.performance_agreement p
     left join master.organization o on o.organization_id=p.organization_id
     left join performance.iku_manual i on i.iku_id=p.iku_id
     left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id
     where p.active=true order by p.year desc,p.created_at desc`);
  }else if(c.has('MANAJER_KINERJA')){
   r=await q(`select p.*,o.organization_name,o.organization_level,i.indicator_name,i.period_consolidation,i.measurement_unit,a.strategic_objective_name
     from performance.performance_agreement p
     left join master.organization o on o.organization_id=p.organization_id
     left join performance.iku_manual i on i.iku_id=p.iku_id
     left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id
     where p.active=true and p.organization_id=$1::uuid order by p.year desc,p.created_at desc`,[req.user.organization_id]);
  }else if(c.has('PIMPINAN_UNIT')){
   r=await q(`with recursive org_tree as (
       select organization_id,parent_id,organization_level from master.organization where organization_id=$1::uuid and is_active=true
       union all
       select o.organization_id,o.parent_id,o.organization_level
       from master.organization o join org_tree p on o.parent_id=p.organization_id
       where o.is_active=true
     )
     select p.*,o.organization_name,o.organization_level,i.indicator_name,i.period_consolidation,i.measurement_unit,a.strategic_objective_name
     from performance.performance_agreement p
     left join master.organization o on o.organization_id=p.organization_id
     left join performance.iku_manual i on i.iku_id=p.iku_id
     left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id
     where p.active=true and p.organization_id in (select organization_id from org_tree)
     order by p.year desc,p.created_at desc`,[req.user.organization_id]);
  }else r={rows:[]};
  res.json(r.rows);
 }catch(e){res.status(500).json({message:e.message})}
});
app.post('/api/performance/pks',async(req,res)=>{const b=req.body;try{const c=normalizedRoleCodes(req.user);if(!isSuperAdmin(req.user)&&!c.has('MANAJER_KINERJA'))return res.status(403).json({message:'Hanya Manajer Kinerja yang dapat membuat PK.'});const orgId=b.organization_id||req.user.organization_id;if(!isSuperAdmin(req.user)&&orgId!==req.user.organization_id)return res.status(403).json({message:'PK harus berasal dari unit kerja Anda.'});const r=await q(`insert into performance.performance_agreement(organization_id,year,strategic_objective_id,iku_id,target_tw1,target_tw2,target_tw3,target_tw4,perjanjian_kinerja_status,bidang_validation_status,pimpinan_validation_status) select $1,i.year,i.strategic_objective_id,$3,coalesce($4,i.target_tw1),coalesce($5,i.target_tw2),coalesce($6,i.target_tw3),coalesce($7,i.target_tw4),'DRAFT','PENDING','PENDING' from performance.iku_manual i where i.iku_id=$3 and i.manual_iku_status='APPROVED' and i.active=true returning *`,[orgId,b.year,b.iku_id,b.target_tw1??null,b.target_tw2??null,b.target_tw3??null,b.target_tw4??null]);if(!r.rows[0])return res.status(400).json({message:'PK hanya dapat dibuat dari Manual IKU yang sudah disetujui kedua pihak.'});res.status(201).json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.post('/api/performance/pks/submit-bulk',async(req,res)=>{
 const year=Number(req.body?.year); const c=normalizedRoleCodes(req.user);
 if(!isSuperAdmin(req.user)&&!c.has('MANAJER_KINERJA'))return res.status(403).json({message:'Hanya Manajer Kinerja yang dapat mengajukan PK.'});
 if(!Number.isInteger(year))return res.status(400).json({message:'Tahun pengajuan tidak valid.'});
 try{
  const r=await q(`update performance.performance_agreement set perjanjian_kinerja_status='SUBMITTED',bidang_validation_status='PENDING',bidang_rejection_reason=null,pimpinan_validation_status='PENDING',pimpinan_rejection_reason=null,updated_at=now() where active=true and organization_id=$1::uuid and year=$2 and perjanjian_kinerja_status in ('DRAFT','REJECTED','APPROVED') returning *`,[req.user.organization_id,year]);
  if(!r.rows.length)return res.status(409).json({message:'Tidak ada data PK yang dapat diajukan pada tahun yang dipilih.'});
  res.json({message:`${r.rows.length} Perjanjian Kinerja berhasil diajukan.`,count:r.rows.length});
 }catch(e){res.status(400).json({message:e.message})}
});
app.post('/api/performance/pks/confirm-bulk',async(req,res)=>{
 const year=Number(req.body?.year); const c=normalizedRoleCodes(req.user);
 if(!isSuperAdmin(req.user)&&!c.has('PIMPINAN_UNIT'))return res.status(403).json({message:'Hanya Pimpinan Unit Kerja yang dapat mengonfirmasi PK.'});
 if(!Number.isInteger(year))return res.status(400).json({message:'Tahun konfirmasi tidak valid.'});
 try{
  const org=(await q(`select organization_id,parent_id,organization_level from master.organization where organization_id=$1::uuid and is_active=true`,[req.user.organization_id])).rows[0];
  if(!org)return res.status(404).json({message:'Organisasi Pimpinan Unit Kerja tidak ditemukan.'});
  const level=String(org.organization_level||'').trim().toUpperCase();
  if(!['UKE_II','UKE_I'].includes(level))return res.status(403).json({message:`Konfirmasi PK hanya tersedia untuk Pimpinan Unit Kerja tingkat UKE_II atau UKE_I. Level organisasi saat ini: ${org.organization_level||'-'}.`});

  // UKE_II: manager berada pada organisasi UKE_II yang sama. Descendant tetap
  // disertakan untuk struktur organisasi bertingkat.
  if(level==='UKE_II'){
   const r=await q(`with recursive org_tree as (
     select organization_id from master.organization where organization_id=$1::uuid and is_active=true
     union all
     select o.organization_id from master.organization o join org_tree t on o.parent_id=t.organization_id where o.is_active=true
   )
   update performance.performance_agreement p
      set perjanjian_kinerja_status='REVIEWED',
          bidang_validation_status='APPROVED',
          updated_at=now()
    from org_tree t
   where p.organization_id=t.organization_id
     and p.active=true
     and p.year=$2
     and p.perjanjian_kinerja_status='SUBMITTED'
   returning p.*`,[req.user.organization_id,year]);
   if(!r.rows.length)return res.status(409).json({message:`Tidak ada data PK SUBMITTED untuk dikonfirmasi pada tahun ${year}.`});
   return res.json({message:`${r.rows.length} Perjanjian Kinerja UKE II berhasil dikonfirmasi.`,count:r.rows.length,status:'REVIEWED'});
  }

  // UKE_I: konfirmasi PK yang sudah direview oleh UKE_II di bawah UKE_I.
  const r=await q(`with recursive org_tree as (
    select organization_id from master.organization where organization_id=$1::uuid and is_active=true
    union all
    select o.organization_id from master.organization o join org_tree t on o.parent_id=t.organization_id where o.is_active=true
  )
  update performance.performance_agreement p
     set perjanjian_kinerja_status='APPROVED',
         pimpinan_validation_status='APPROVED',
         updated_at=now()
   from org_tree t
  where p.organization_id=t.organization_id
    and p.active=true
    and p.year=$2
    and p.perjanjian_kinerja_status='REVIEWED'
  returning p.*`,[req.user.organization_id,year]);
  if(!r.rows.length)return res.status(409).json({message:`Tidak ada data PK REVIEWED untuk dikonfirmasi pada tahun ${year}.`});
  res.json({message:`${r.rows.length} Perjanjian Kinerja UKE I berhasil dikonfirmasi.`,count:r.rows.length,status:'APPROVED'});
 }catch(e){
  console.error('confirm-bulk PK error:',e);
  res.status(500).json({message:'Gagal mengonfirmasi Perjanjian Kinerja.',detail:e.message});
 }
});
app.post('/api/performance/pks/:id/status',async(req,res)=>{const next=String(req.body.status||'').toUpperCase(),notes=String(req.body.notes||'').trim()||null;try{const old=(await q(`select * from performance.performance_agreement where agreement_id=$1 and active=true`,[req.params.id])).rows[0];if(!old)return res.status(404).json({message:'Perjanjian Kinerja tidak ditemukan'});const c=normalizedRoleCodes(req.user);if(next==='SUBMITTED'&&['DRAFT','REJECTED'].includes(old.perjanjian_kinerja_status)&&(isSuperAdmin(req.user)||c.has('MANAJER_KINERJA'))&&old.organization_id===req.user.organization_id){const r=await q(`update performance.performance_agreement set perjanjian_kinerja_status='SUBMITTED',bidang_validation_status='PENDING',pimpinan_validation_status='PENDING',updated_at=now() where agreement_id=$1 returning *`,[req.params.id]);return res.json(r.rows[0])}if(next==='REVIEWED'&&old.perjanjian_kinerja_status==='SUBMITTED'&&(isSuperAdmin(req.user)||c.has('PIMPINAN_UNIT'))){return res.status(400).json({message:'Gunakan konfirmasi massal berdasarkan tahun.'})}if(next==='APPROVED'&&old.perjanjian_kinerja_status==='REVIEWED'&&(isSuperAdmin(req.user)||c.has('PIMPINAN_UNIT'))){return res.status(400).json({message:'Gunakan konfirmasi massal berdasarkan tahun.'})}if(next==='REJECTED'&&!notes)return res.status(400).json({message:'Alasan penolakan wajib diisi.'});return res.status(403).json({message:'Perubahan status PK tidak sesuai alur validasi.'})}catch(e){res.status(400).json({message:e.message})}});
app.get('/api/performance/outputs',async(_,res)=>{try{res.json((await q(`select m.*,o.organization_name from performance.output_manual m left join master.organization o on o.organization_id=m.organization_id order by m.year desc,m.created_at desc`)).rows)}catch(e){res.status(500).json({message:e.message})}});
app.post('/api/performance/outputs',async(req,res)=>{const b=req.body||{};try{const organizationId=b.organization_id||req.user?.organization_id||null;if(!organizationId)return res.status(400).json({message:'Unit kerja belum terhubung dengan pengguna.',code:'ORG_REQUIRED'});const r=await q(`insert into performance.output_manual(organization_id,year,classification_code,output_name,output_indicator,output_type,target_value,unit,component,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT') returning *`,[organizationId,b.year,b.classification_code||null,b.output_name,b.output_indicator||null,b.output_type,b.target_value??null,b.unit||null,b.component||null]);res.status(201).json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.put('/api/performance/outputs/:id',async(req,res)=>{const b=req.body;try{const r=await q(`update performance.output_manual set classification_code=$1,output_name=$2,output_indicator=$3,output_type=$4,target_value=$5,unit=$6,component=$7,updated_at=now() where output_manual_id=$8 returning *`,[b.classification_code||null,b.output_name,b.output_indicator||null,b.output_type,b.target_value??null,b.unit||null,b.component||null,req.params.id]);if(!r.rows[0])return res.status(404).json({message:'Manual Rincian Output tidak ditemukan'});res.json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.post('/api/performance/outputs/:id/status',async(req,res)=>{await performanceStatus(req,res,'performance.output_manual','output_manual_id')});

async function performanceStatus(req,res,table,key){const allowed=['DRAFT','REVIEW','APPROVED','REJECTED'];const status=String(req.body.status||'').toUpperCase();if(!allowed.includes(status))return res.status(400).json({message:'Status tidak valid'});try{const r=await q(`update ${table} set status=$1,updated_at=now() where ${key}=$2 returning *`,[status,req.params.id]);if(!r.rows[0])return res.status(404).json({message:'Dokumen tidak ditemukan'});res.json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}}

// =========================
// RISK MANAGEMENT / MANAJEMEN RISIKO
// User Requirement: LKK -> FAR + IRU -> FPR. Monitoring & Reviu tetap modul terpisah.
// =========================
const RISK_STATUSES=new Set(['DRAFT','SUBMITTED','REVIEWED','APPROVED','REJECTED']);
function roleHas(req,code){return isSuperAdmin(req.user)||normalizedRoleCodes(req.user).has(code)}
function riskWideAccess(req){const c=normalizedRoleCodes(req.user);return isSuperAdmin(req.user)||c.has('BIDANG_KINERJA_RISIKO')||c.has('KEPALA_PUSAT_PPSPK')}
function riskOrgScope(req){if(riskWideAccess(req))return null;const ids=[...new Set((req.user.roles||[]).map(r=>r.organization_id).filter(Boolean))];if(req.user.organization_id&&!ids.includes(req.user.organization_id))ids.push(req.user.organization_id);return ids}
function canRiskAuthor(req){return roleHas(req,'MANAJER_RISIKO')}
function canRiskReview(req){return roleHas(req,'BIDANG_KINERJA_RISIKO')}
function canRiskApprove(req){return roleHas(req,'PIMPINAN_UNIT')||roleHas(req,'KEPALA_PUSAT_PPSPK')}
function validateIndex(v,name){if(v===undefined||v===null||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>1)throw new Error(`${name} harus bernilai 0 sampai 1`);return n}
function normalizeRiskCode(v){const n=Number(v);if(!Number.isFinite(n)||n<0)return null;return String(Math.max(0,Math.round(n))).padStart(2,'0').slice(-2)}
function isUuid(v){return typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)}
async function resolveRiskReference(table,idColumn,value,label,nameColumn='name',codeColumn='code'){
  if(value===undefined||value===null||value==='') return null;
  const raw=String(value).trim();
  if(isUuid(raw)){
    const r=await q(`select ${idColumn} from ${table} where ${idColumn}=$1`,[raw]);
    if(!r.rows[0]) throw new Error(`${label} tidak ditemukan`);
    return r.rows[0][idColumn];
  }
  const r=await q(`select ${idColumn} from ${table} where lower(${nameColumn})=lower($1) or lower(${codeColumn})=lower($1) limit 1`,[raw]);
  if(!r.rows[0]) throw new Error(`${label} tidak ditemukan. Pilih ${label} dari daftar referensi.`);
  return r.rows[0][idColumn];
}
// UR menyatakan Current Risk = Inherent Risk x IPI dan Target Residual Risk = Current Risk x IPR.
function calcCurrent(inherent,ipi){if(inherent===undefined||inherent===null||inherent===''||ipi===undefined||ipi===null||ipi==='')return {code:null,level:null};const score=Math.max(0,Math.round(Number(inherent)*Number(ipi)));return {code:normalizeRiskCode(score),level:riskLevel(score)}}
function calcResidual(current,ipr){if(current===undefined||current===null||current===''||ipr===undefined||ipr===null||ipr==='')return {code:null};const score=Math.max(0,Math.round(Number(current)*Number(ipr)));return {code:normalizeRiskCode(score)}}
// Dokumen UR hanya menunjuk Perpim No. 1 Tahun 2024 tanpa matriks rinci. Ambang ini dipertahankan
// sebagai fallback aplikasi dan dapat diganti melalui master.risk_level_rule (migration 009).
function riskLevel(score){if(score>=15)return 'Sangat Tinggi';if(score>=10)return 'Tinggi';if(score>=5)return 'Sedang';return 'Rendah'}
async function resolvedRiskLevel(score){try{const r=await q(`select level_name from master.risk_level_rule where $1 between min_score and max_score and is_active=true order by min_score desc limit 1`,[score]);return r.rows[0]?.level_name||riskLevel(score)}catch{return riskLevel(score)}}
async function audit(req,action,table,recordId,oldData,newData,organizationId){try{await q(`insert into system.audit_log(user_id,organization_id,action,table_name,record_id,old_data,new_data,ip_address,user_agent) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[req.user.user_id,organizationId||req.user.organization_id||null,action,table,recordId||null,oldData?JSON.stringify(oldData):null,newData?JSON.stringify(newData):null,req.ip||null,req.headers['user-agent']||null])}catch(e){console.error('audit_log:',e.message)}}
async function ensureWorkflow(documentType,referenceId,organizationId,createdBy){let r=await q(`select document_id,current_status from system.workflow_document where document_type=$1 and reference_id=$2 order by created_at desc limit 1`,[documentType,referenceId]);if(r.rows[0])return r.rows[0];r=await q(`insert into system.workflow_document(document_type,reference_id,organization_id,current_status,created_by) values($1,$2,$3,'DRAFT',$4) returning document_id,current_status`,[documentType,referenceId,organizationId,createdBy]);return r.rows[0]}
async function syncWorkflow(req,documentType,referenceId,organizationId,fromStatus,toStatus,action,notes){const d=await ensureWorkflow(documentType,referenceId,organizationId,req.user.user_id);await q(`update system.workflow_document set current_status=$1 where document_id=$2`,[toStatus,d.document_id]);await q(`insert into system.workflow_history(document_id,from_status,to_status,action,actor_user_id,notes) values($1,$2,$3,$4,$5,$6)`,[d.document_id,fromStatus||d.current_status,toStatus,action,req.user.user_id,notes||null])}
function statusPermission(req,current,next){if(!RISK_STATUSES.has(next))return false;if(isSuperAdmin(req.user))return true;if(next==='SUBMITTED')return canRiskAuthor(req)&&(current==='DRAFT'||current==='REJECTED');if(next==='REVIEWED')return canRiskReview(req)&&current==='SUBMITTED';if(next==='APPROVED')return canRiskApprove(req)&&current==='REVIEWED';if(next==='REJECTED')return (canRiskReview(req)&&current==='SUBMITTED')||(canRiskApprove(req)&&current==='REVIEWED');if(next==='DRAFT')return canRiskAuthor(req)&&current==='REJECTED';return false}
async function changeRiskStatus(req,res,{table,key,documentType,orgSql}){const next=String(req.body.status||'').toUpperCase();const notes=String(req.body.notes||'').trim()||null;if(!RISK_STATUSES.has(next))return res.status(400).json({message:'Status tidak valid'});try{const old=(await q(`select x.*, ${orgSql} organization_id from ${table} x where x.${key}=$1`,[req.params.id])).rows[0];if(!old)return res.status(404).json({message:'Dokumen tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(old.organization_id))return res.status(403).json({message:'Dokumen berada di luar unit kerja Anda'});if(!statusPermission(req,old.status,next))return res.status(403).json({message:`Perubahan status ${old.status} -> ${next} tidak sesuai kewenangan/alur reviu`});const updated=(await q(`update ${table} set status=$1,rejection_reason=case when $3='REJECTED' then $4 else null end where ${key}=$2 returning *`,[next,req.params.id,next,notes])).rows[0];await syncWorkflow(req,documentType,req.params.id,old.organization_id,old.status,next,next,notes);await audit(req,'STATUS',table,req.params.id,old,updated,old.organization_id);res.json(updated)}catch(e){res.status(400).json({message:e.message})}}
function ensureEditable(req,row){if(!row)throw Object.assign(new Error('Dokumen tidak ditemukan'),{statusCode:404});const scope=riskOrgScope(req);if(scope&&!scope.includes(row.organization_id))throw Object.assign(new Error('Dokumen berada di luar unit kerja Anda'),{statusCode:403});if(!canRiskAuthor(req))throw Object.assign(new Error('Hanya Manajer Risiko yang dapat mengubah data Manajemen Risiko'),{statusCode:403});if(!['DRAFT','REJECTED'].includes(row.status))throw Object.assign(new Error('Dokumen hanya dapat diubah pada status DRAFT atau REJECTED'),{statusCode:409})}

// Referensi prefill LKK menggunakan Manajemen Kinerja (Perencanaan Strategis belum menjadi sumber aktif).
app.get('/api/risk/references',async(req,res)=>{try{const scope=riskOrgScope(req);const [ikus,pks,outputs,processes,categories,employees]=await Promise.all([
 q(`select i.iku_id,i.indicator_name,i.year,i.organization_id,o.organization_name,coalesce(so.name,i.strategic_objective_name) strategic_objective_name,coalesce(so.code,'') strategic_objective_code from performance.iku_manual i join master.organization o on o.organization_id=i.organization_id left join planning.strategic_objective so on so.strategic_objective_id=i.strategic_objective_id where i.active=true and i.manual_iku_status='APPROVED' and i.bidang_validation_status='APPROVED' and i.pimpinan_validation_status='APPROVED' and ($1::uuid[] is null or i.organization_id=any($1::uuid[])) order by i.year desc,coalesce(so.name,i.strategic_objective_name) nulls last,i.indicator_name`,[scope]),
 q(`select p.agreement_id,p.iku_id,p.year,p.organization_id,i.indicator_name,coalesce(so.name,i.strategic_objective_name) strategic_objective_name from performance.performance_agreement p join performance.iku_manual i on i.iku_id=p.iku_id left join planning.strategic_objective so on so.strategic_objective_id=i.strategic_objective_id where p.active=true and p.perjanjian_kinerja_status='APPROVED' and ($1::uuid[] is null or p.organization_id=any($1::uuid[])) order by p.year desc,i.indicator_name`,[scope]),
 q(`select output_manual_id,classification_code code,output_name name,year,organization_id,target_value,unit from performance.output_manual where ($1::uuid[] is null or organization_id=any($1::uuid[])) order by year desc,output_name`,[scope]),
 q(`select business_process_id,code,name,level from master.business_process where is_active=true order by level nulls last,code`),
 q(`select risk_category_id,code,name from master.risk_category where is_active=true order by name`),
 q(`select e.employee_id,e.employee_number,e.employee_name,e.position_name,e.organization_id,o.organization_name from master.employee e join master.organization o on o.organization_id=e.organization_id where e.is_active=true and ($1::uuid[] is null or e.organization_id=any($1::uuid[])) order by e.employee_name`,[scope])
]);res.json({performance_ikus:ikus.rows,performance_pks:pks.rows,performance_outputs:outputs.rows,business_processes:processes.rows,risk_categories:categories.rows,employees:employees.rows,activity_objectives:[],activity_indicators:[],outputs:[]})}catch(e){res.status(500).json({message:e.message})}});

// LINGKUP, KONTEKS DAN KRITERIA (LKK)
app.get('/api/risk/contexts',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select rc.*,o.organization_name,i.indicator_name performance_iku_name,i.year performance_iku_year,a.strategic_objective_name,p.agreement_id performance_agreement_id,om.output_name performance_output_name,bp.code business_process_code,bp.name business_process_name from risk.risk_context rc join master.organization o on o.organization_id=rc.organization_id left join performance.iku_manual i on i.iku_id=rc.performance_iku_id left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id left join performance.performance_agreement p on p.agreement_id=rc.performance_agreement_id left join performance.output_manual om on om.output_manual_id=rc.performance_output_manual_id left join master.business_process bp on bp.business_process_id=rc.business_process_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[])) order by rc.created_at desc`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/contexts/:id',async(req,res)=>{try{const scope=riskOrgScope(req);const r=await q(`select rc.*,o.organization_name,i.indicator_name performance_iku_name,a.strategic_objective_name,p.agreement_id performance_agreement_id,om.output_name performance_output_name,bp.name business_process_name from risk.risk_context rc join master.organization o on o.organization_id=rc.organization_id left join performance.iku_manual i on i.iku_id=rc.performance_iku_id left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id left join performance.performance_agreement p on p.agreement_id=rc.performance_agreement_id left join performance.output_manual om on om.output_manual_id=rc.performance_output_manual_id left join master.business_process bp on bp.business_process_id=rc.business_process_id where rc.risk_context_id=$1 and ($2::uuid[] is null or rc.organization_id=any($2::uuid[]))`,[req.params.id,scope]);if(!r.rows[0])return res.status(404).json({message:'LKK tidak ditemukan'});res.json(r.rows[0])}catch(e){res.status(500).json({message:e.message})}});
app.post('/api/risk/contexts',async(req,res)=>{
 if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat menyusun LKK'});
 const b=req.body||{}; if(!b.organization_id)return res.status(400).json({message:'Unit kerja wajib diisi'});
 try{
  const scope=riskOrgScope(req); if(scope&&!scope.includes(b.organization_id))return res.status(403).json({message:'Unit kerja berada di luar kewenangan Anda'});
  const iku=(await q(`select i.iku_id,i.organization_id from performance.iku_manual i where i.iku_id=$1 and i.active=true and i.manual_iku_status='APPROVED' and i.bidang_validation_status='APPROVED' and i.pimpinan_validation_status='APPROVED' and ($2::uuid[] is null or i.organization_id=any($2::uuid[]))`,[b.performance_iku_id,scope])).rows[0];
  if(!iku)return res.status(400).json({message:'Manual IKU belum disetujui kedua pihak atau tidak sesuai unit kerja.'});
  const r=await q(`insert into risk.risk_context(organization_id,performance_iku_id,performance_agreement_id,performance_output_manual_id,output_detail,business_process_detail,external_context,internal_context,created_by,status,selected_for_submission)
    values($1,$2,nullif($3,''),nullif($4,''),$5,$6,$7,$8,$9,'DRAFT',false) returning *`,
    [b.organization_id,b.performance_iku_id,b.performance_agreement_id||'',b.performance_output_manual_id||'',b.output_detail||'',b.business_process_detail||'',b.external_context||null,b.internal_context||null,req.user.user_id]);
  await ensureWorkflow('RISK_CONTEXT',r.rows[0].risk_context_id,b.organization_id,req.user.user_id);
  await audit(req,'CREATE','risk.risk_context',r.rows[0].risk_context_id,null,r.rows[0],b.organization_id);res.status(201).json(r.rows[0])
 }catch(e){res.status(400).json({message:e.message})}
});
app.post('/api/risk/contexts/submit',async(req,res)=>{
 if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat mengajukan LKK'});
 const ids=Array.isArray(req.body?.ids)?req.body.ids:[];if(!ids.length)return res.status(400).json({message:'Pilih minimal satu LKK.'});
 try{const scope=riskOrgScope(req);const r=await q(`update risk.risk_context set status='SUBMITTED',selected_for_submission=false,submitted_at=now() where risk_context_id=any($1::uuid[]) and status in ('DRAFT','REJECTED') and ($2::uuid[] is null or organization_id=any($2::uuid[])) returning *`,[ids,scope]);if(r.rows.length!==ids.length)return res.status(400).json({message:'Sebagian LKK tidak dapat diajukan.'});for(const x of r.rows)await syncWorkflow(req,'RISK_CONTEXT',x.risk_context_id,x.organization_id,'DRAFT','SUBMITTED','SUBMIT',null);res.json(r.rows)}
 catch(e){res.status(400).json({message:e.message})}
});
app.put('/api/risk/contexts/:id',async(req,res)=>{const b=req.body||{};try{const old=(await q(`select * from risk.risk_context where risk_context_id=$1`,[req.params.id])).rows[0];ensureEditable(req,old);const businessProcessId=null;const ikuId=b.performance_iku_id||null;const agreementId=null;const outputId=null;if(ikuId){const valid=(await q(`select 1 from performance.iku_manual where iku_id=$1 and organization_id=$2 and manual_iku_status='APPROVED' and active=true`,[ikuId,old.organization_id])).rows[0];if(!valid)return res.status(400).json({message:'Manual IKU tidak sesuai unit kerja'})}if(agreementId){const valid=(await q(`select 1 from performance.performance_agreement where agreement_id=$1 and organization_id=$2 and ($3::uuid is null or iku_id=$3)`,[agreementId,old.organization_id,ikuId])).rows[0];if(!valid)return res.status(400).json({message:'Perjanjian Kinerja tidak sesuai Manual IKU'})}if(outputId){const valid=(await q(`select 1 from performance.output_manual where output_manual_id=$1 and organization_id=$2`,[outputId,old.organization_id])).rows[0];if(!valid)return res.status(400).json({message:'Output Manajemen Kinerja tidak sesuai unit kerja'})}const r=await q(`update risk.risk_context set performance_iku_id=$1,performance_agreement_id=$2,performance_output_manual_id=$3,output_detail=$4,business_process_detail=$5,external_context=$6,internal_context=$7 where risk_context_id=$8 returning *`,[ikuId,agreementId,outputId,b.output_detail||'',b.business_process_detail||'',b.external_context||null,b.internal_context||null,req.params.id]);await audit(req,'UPDATE','risk.risk_context',req.params.id,old,r.rows[0],old.organization_id);res.json(r.rows[0])}catch(e){res.status(e.statusCode||400).json({message:e.message})}});
app.delete('/api/risk/contexts/:id',async(req,res)=>{try{const old=(await q(`select * from risk.risk_context where risk_context_id=$1`,[req.params.id])).rows[0];ensureEditable(req,old);await q(`delete from risk.risk_context where risk_context_id=$1`,[req.params.id]);await audit(req,'DELETE','risk.risk_context',req.params.id,old,null,old.organization_id);res.json({message:'LKK berhasil dihapus'})}catch(e){res.status(e.statusCode||400).json({message:e.message})}});
app.post('/api/risk/contexts/:id/status',async(req,res)=>changeRiskStatus(req,res,{table:'risk.risk_context',key:'risk_context_id',documentType:'RISK_CONTEXT',orgSql:'x.organization_id'}));

// FORMULIR ASESMEN RISIKO (FAR)
app.get('/api/risk/assessments',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select ra.*,rc.organization_id,o.organization_name,c.code risk_category_code,c.name risk_category_name,rc.performance_iku_id,i.indicator_name performance_iku_name,a.strategic_objective_name,rc.performance_output_manual_id,om.output_name performance_output_name,rc.performance_agreement_id,rc.business_process_id,bp.name business_process_name from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id join master.organization o on o.organization_id=rc.organization_id join master.risk_category c on c.risk_category_id=ra.risk_category_id left join performance.iku_manual i on i.iku_id=rc.performance_iku_id left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id left join performance.output_manual om on om.output_manual_id=rc.performance_output_manual_id left join master.business_process bp on bp.business_process_id=rc.business_process_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[])) order by ra.created_at desc`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/assessments/:id',async(req,res)=>{try{const scope=riskOrgScope(req);const r=await q(`select ra.*,rc.organization_id,o.organization_name,c.name risk_category_name,rc.performance_iku_id,i.indicator_name performance_iku_name,a.strategic_objective_name,rc.performance_output_manual_id,om.output_name performance_output_name,rc.performance_agreement_id,rc.business_process_id,bp.name business_process_name from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id join master.organization o on o.organization_id=rc.organization_id join master.risk_category c on c.risk_category_id=ra.risk_category_id left join performance.iku_manual i on i.iku_id=rc.performance_iku_id left join performance.v_iku_strategic_alignment a on a.iku_id=i.iku_id left join performance.output_manual om on om.output_manual_id=rc.performance_output_manual_id left join master.business_process bp on bp.business_process_id=rc.business_process_id where ra.risk_assessment_id=$1 and ($2::uuid[] is null or rc.organization_id=any($2::uuid[]))`,[req.params.id,scope]);if(!r.rows[0])return res.status(404).json({message:'Asesmen Risiko tidak ditemukan'});res.json(r.rows[0])}catch(e){res.status(500).json({message:e.message})}});
app.post('/api/risk/assessments',async(req,res)=>{if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat menyusun Formulir Asesmen Risiko'});const b=req.body||{};if(!b.risk_context_id||!String(b.risk_description||'').trim()||!b.risk_category_id)return res.status(400).json({message:'LKK, Risiko, dan Kategori Risiko wajib diisi'});try{const ctx=(await q(`select organization_id,status from risk.risk_context where risk_context_id=$1`,[b.risk_context_id])).rows[0];if(!ctx)return res.status(404).json({message:'LKK tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(ctx.organization_id))return res.status(403).json({message:'LKK berada di luar unit kerja Anda'});const ipi=validateIndex(b.internal_control_index,'IPI');const current=calcCurrent(b.inherent_risk,ipi);if(current.code!==null)current.level=await resolvedRiskLevel(Number(current.code));const r=await q(`insert into risk.risk_assessment(risk_context_id,risk_code,risk_description,cause,impact,risk_category_id,inherent_risk,existing_control,internal_control_index,current_risk,risk_level,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DRAFT') returning *`,[b.risk_context_id,b.risk_code||null,String(b.risk_description).trim(),b.cause||null,b.impact||null,b.risk_category_id,b.inherent_risk||null,b.existing_control||null,ipi,current.code,current.level]);await ensureWorkflow('RISK_ASSESSMENT',r.rows[0].risk_assessment_id,ctx.organization_id,req.user.user_id);await audit(req,'CREATE','risk.risk_assessment',r.rows[0].risk_assessment_id,null,r.rows[0],ctx.organization_id);res.status(201).json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.put('/api/risk/assessments/:id',async(req,res)=>{const b=req.body||{};try{const old=(await q(`select ra.*,rc.organization_id from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.risk_assessment_id=$1`,[req.params.id])).rows[0];ensureEditable(req,old);const ipi=validateIndex(b.internal_control_index,'IPI');const current=calcCurrent(b.inherent_risk,ipi);if(current.code!==null)current.level=await resolvedRiskLevel(Number(current.code));const r=await q(`update risk.risk_assessment set risk_code=$1,risk_description=$2,cause=$3,impact=$4,risk_category_id=$5,inherent_risk=$6,existing_control=$7,internal_control_index=$8,current_risk=$9,risk_level=$10 where risk_assessment_id=$11 returning *`,[b.risk_code||null,b.risk_description,b.cause||null,b.impact||null,b.risk_category_id,b.inherent_risk||null,b.existing_control||null,ipi,current.code,current.level,req.params.id]);await audit(req,'UPDATE','risk.risk_assessment',req.params.id,old,r.rows[0],old.organization_id);res.json(r.rows[0])}catch(e){res.status(e.statusCode||400).json({message:e.message})}});
app.delete('/api/risk/assessments/:id',async(req,res)=>{try{const old=(await q(`select ra.*,rc.organization_id from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.risk_assessment_id=$1`,[req.params.id])).rows[0];ensureEditable(req,old);await q(`delete from risk.risk_assessment where risk_assessment_id=$1`,[req.params.id]);await audit(req,'DELETE','risk.risk_assessment',req.params.id,old,null,old.organization_id);res.json({message:'Asesmen Risiko berhasil dihapus'})}catch(e){res.status(e.statusCode||400).json({message:e.message})}});
app.post('/api/risk/assessments/:id/status',async(req,res)=>changeRiskStatus(req,res,{table:'risk.risk_assessment',key:'risk_assessment_id',documentType:'RISK_ASSESSMENT',orgSql:'(select organization_id from risk.risk_context where risk_context_id=x.risk_context_id)'}));

// INDIKATOR RISIKO UTAMA (IRU)
app.get('/api/risk/indicators',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select ri.*,ra.risk_code,ra.risk_description,ra.status assessment_status,rc.organization_id,o.organization_name from risk.risk_indicator ri join risk.risk_assessment ra on ra.risk_assessment_id=ri.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id join master.organization o on o.organization_id=rc.organization_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[])) order by ra.risk_code nulls last,ri.indicator_name`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/assessments/:id/indicators',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select ri.* from risk.risk_indicator ri join risk.risk_assessment ra on ra.risk_assessment_id=ri.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ri.risk_assessment_id=$1 and ($2::uuid[] is null or rc.organization_id=any($2::uuid[])) order by ri.indicator_name`,[req.params.id,scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.post('/api/risk/indicators',async(req,res)=>{if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat menyusun IRU'});const b=req.body||{};if(!b.risk_assessment_id||!String(b.indicator_name||'').trim())return res.status(400).json({message:'Risiko dan Nama Indikator Risiko Utama wajib diisi'});try{const parent=(await q(`select ra.status,rc.organization_id from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.risk_assessment_id=$1`,[b.risk_assessment_id])).rows[0];if(!parent)return res.status(404).json({message:'Asesmen Risiko tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(parent.organization_id))return res.status(403).json({message:'Risiko berada di luar unit kerja Anda'});if(!['DRAFT','REJECTED'].includes(parent.status))return res.status(409).json({message:'IRU hanya dapat diubah ketika Asesmen Risiko berstatus DRAFT atau REJECTED'});const r=await q(`insert into risk.risk_indicator(risk_assessment_id,indicator_name,value_limit,unit,status) values($1,$2,$3,$4,'DRAFT') returning *`,[b.risk_assessment_id,String(b.indicator_name).trim(),b.value_limit||null,b.unit||null]);await ensureWorkflow('RISK_INDICATOR',r.rows[0].risk_indicator_id,parent.organization_id,req.user.user_id);await audit(req,'CREATE','risk.risk_indicator',r.rows[0].risk_indicator_id,null,r.rows[0],parent.organization_id);res.status(201).json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.put('/api/risk/indicators/:id',async(req,res)=>{const b=req.body||{};try{const old=(await q(`select ri.*,ra.status assessment_status,rc.organization_id from risk.risk_indicator ri join risk.risk_assessment ra on ra.risk_assessment_id=ri.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ri.risk_indicator_id=$1`,[req.params.id])).rows[0];if(!old)return res.status(404).json({message:'IRU tidak ditemukan'});if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat mengubah IRU'});const scope=riskOrgScope(req);if(scope&&!scope.includes(old.organization_id))return res.status(403).json({message:'IRU berada di luar unit kerja Anda'});if(!['DRAFT','REJECTED'].includes(old.status))return res.status(409).json({message:'IRU hanya dapat diubah pada status DRAFT atau REJECTED'});const r=await q(`update risk.risk_indicator set indicator_name=$1,value_limit=$2,unit=$3 where risk_indicator_id=$4 returning *`,[b.indicator_name,b.value_limit||null,b.unit||null,req.params.id]);await audit(req,'UPDATE','risk.risk_indicator',req.params.id,old,r.rows[0],old.organization_id);res.json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.delete('/api/risk/indicators/:id',async(req,res)=>{try{const old=(await q(`select ri.*,ra.status assessment_status,rc.organization_id from risk.risk_indicator ri join risk.risk_assessment ra on ra.risk_assessment_id=ri.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ri.risk_indicator_id=$1`,[req.params.id])).rows[0];if(!old)return res.status(404).json({message:'IRU tidak ditemukan'});if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat menghapus IRU'});const scope=riskOrgScope(req);if(scope&&!scope.includes(old.organization_id))return res.status(403).json({message:'IRU berada di luar unit kerja Anda'});if(!['DRAFT','REJECTED'].includes(old.status))return res.status(409).json({message:'IRU hanya dapat dihapus pada status DRAFT atau REJECTED'});await q(`delete from risk.risk_indicator where risk_indicator_id=$1`,[req.params.id]);await audit(req,'DELETE','risk.risk_indicator',req.params.id,old,null,old.organization_id);res.json({message:'IRU berhasil dihapus'})}catch(e){res.status(400).json({message:e.message})}});

app.post('/api/risk/indicators/:id/status',async(req,res)=>changeRiskStatus(req,res,{table:'risk.risk_indicator',key:'risk_indicator_id',documentType:'RISK_INDICATOR',orgSql:'(select rc.organization_id from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.risk_assessment_id=x.risk_assessment_id)'}));

// FORMULIR PERLAKUAN RISIKO (FPR)
app.get('/api/risk/treatments',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select rt.*,ra.risk_code,ra.risk_description,ra.current_risk,rc.organization_id,o.organization_name,e.employee_name pic_employee_name,e.position_name pic_position_name from risk.risk_treatment rt join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id join master.organization o on o.organization_id=rc.organization_id left join master.employee e on e.employee_id=rt.pic_employee_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[])) order by rt.schedule_date nulls last,rt.risk_treatment_id desc`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/treatments/:id',async(req,res)=>{try{const scope=riskOrgScope(req);const r=await q(`select rt.*,ra.risk_code,ra.risk_description,ra.current_risk,rc.organization_id,o.organization_name,e.employee_name pic_employee_name from risk.risk_treatment rt join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id join master.organization o on o.organization_id=rc.organization_id left join master.employee e on e.employee_id=rt.pic_employee_id where rt.risk_treatment_id=$1 and ($2::uuid[] is null or rc.organization_id=any($2::uuid[]))`,[req.params.id,scope]);if(!r.rows[0])return res.status(404).json({message:'Perlakuan Risiko tidak ditemukan'});res.json(r.rows[0])}catch(e){res.status(500).json({message:e.message})}});
app.post('/api/risk/treatments',async(req,res)=>{if(!canRiskAuthor(req))return res.status(403).json({message:'Hanya Manajer Risiko yang dapat menyusun Formulir Perlakuan Risiko'});const b=req.body||{};if(!b.risk_assessment_id||!String(b.treatment_plan||'').trim())return res.status(400).json({message:'Risiko dan Rencana Perlakuan Risiko wajib diisi'});try{const ra=(await q(`select ra.current_risk,rc.organization_id from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.risk_assessment_id=$1`,[b.risk_assessment_id])).rows[0];if(!ra)return res.status(404).json({message:'Risk assessment tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(ra.organization_id))return res.status(403).json({message:'Risiko berada di luar unit kerja Anda'});const ipr=validateIndex(b.treatment_index,'IPR');const residual=calcResidual(ra.current_risk,ipr);const r=await q(`insert into risk.risk_treatment(risk_assessment_id,treatment_plan,required_resource,treatment_index,target_residual_risk,schedule_date,pic_employee_id,status) values($1,$2,$3,$4,$5,$6,$7,'DRAFT') returning *`,[b.risk_assessment_id,String(b.treatment_plan).trim(),b.required_resource||null,ipr,residual.code,b.schedule_date||null,b.pic_employee_id||null]);await ensureWorkflow('RISK_TREATMENT',r.rows[0].risk_treatment_id,ra.organization_id,req.user.user_id);await audit(req,'CREATE','risk.risk_treatment',r.rows[0].risk_treatment_id,null,r.rows[0],ra.organization_id);res.status(201).json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.put('/api/risk/treatments/:id',async(req,res)=>{const b=req.body||{};try{const old=(await q(`select rt.*,ra.current_risk,rc.organization_id from risk.risk_treatment rt join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where rt.risk_treatment_id=$1`,[req.params.id])).rows[0];ensureEditable(req,old);const ipr=validateIndex(b.treatment_index,'IPR');const residual=calcResidual(old.current_risk,ipr);const r=await q(`update risk.risk_treatment set treatment_plan=$1,required_resource=$2,treatment_index=$3,target_residual_risk=$4,schedule_date=$5,pic_employee_id=$6 where risk_treatment_id=$7 returning *`,[b.treatment_plan,b.required_resource||null,ipr,residual.code,b.schedule_date||null,b.pic_employee_id||null,req.params.id]);await audit(req,'UPDATE','risk.risk_treatment',req.params.id,old,r.rows[0],old.organization_id);res.json(r.rows[0])}catch(e){res.status(e.statusCode||400).json({message:e.message})}});
app.delete('/api/risk/treatments/:id',async(req,res)=>{try{const old=(await q(`select rt.*,rc.organization_id from risk.risk_treatment rt join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where rt.risk_treatment_id=$1`,[req.params.id])).rows[0];ensureEditable(req,old);await q(`delete from risk.risk_treatment where risk_treatment_id=$1`,[req.params.id]);await audit(req,'DELETE','risk.risk_treatment',req.params.id,old,null,old.organization_id);res.json({message:'Perlakuan Risiko berhasil dihapus'})}catch(e){res.status(e.statusCode||400).json({message:e.message})}});
app.post('/api/risk/treatments/:id/status',async(req,res)=>changeRiskStatus(req,res,{table:'risk.risk_treatment',key:'risk_treatment_id',documentType:'RISK_TREATMENT',orgSql:'(select rc.organization_id from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.risk_assessment_id=x.risk_assessment_id)'}));

// Profil risiko, heatmap, dan workflow history untuk dashboard/reviu.
app.get('/api/risk/profile',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select v.*,ra.cause,ra.impact,ra.existing_control,ra.internal_control_index,ra.status assessment_status,coalesce((select json_agg(json_build_object('risk_indicator_id',ri.risk_indicator_id,'indicator_name',ri.indicator_name,'value_limit',ri.value_limit,'unit',ri.unit,'status',ri.status) order by ri.indicator_name) from risk.risk_indicator ri where ri.risk_assessment_id=ra.risk_assessment_id),'[]') indicators from risk.v_risk_profile v join risk.risk_assessment ra on ra.risk_assessment_id=v.risk_assessment_id where ($1::uuid[] is null or v.organization_id=any($1::uuid[])) order by v.organization_name,v.risk_code`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/heatmap',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select ra.inherent_risk,ra.current_risk,coalesce(rt.target_residual_risk,'') target_residual_risk,count(*)::int total from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id left join lateral(select target_residual_risk from risk.risk_treatment t where t.risk_assessment_id=ra.risk_assessment_id order by schedule_date desc nulls last limit 1) rt on true where ($1::uuid[] is null or rc.organization_id=any($1::uuid[])) group by ra.inherent_risk,ra.current_risk,rt.target_residual_risk order by total desc`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/workflow/:documentType/:referenceId',async(req,res)=>{try{const dt=String(req.params.documentType||'').toUpperCase();const r=await q(`select wd.document_id,wd.document_type,wd.reference_id,wd.current_status,wd.organization_id,wh.from_status,wh.to_status,wh.action,wh.notes,wh.action_at,u.username,e.employee_name actor_name from system.workflow_document wd left join system.workflow_history wh on wh.document_id=wd.document_id left join master.app_user u on u.user_id=wh.actor_user_id left join master.employee e on e.employee_id=u.employee_id where wd.document_type=$1 and wd.reference_id=$2 order by wh.action_at asc nulls first`,[dt,req.params.referenceId]);if(!r.rows.length)return res.status(404).json({message:'Workflow tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(r.rows[0].organization_id))return res.status(403).json({message:'Workflow berada di luar unit kerja Anda'});res.json(r.rows)}catch(e){res.status(500).json({message:e.message})}});
app.get('/api/risk/summary',async(req,res)=>{try{const scope=riskOrgScope(req);const [a,t,c,i,approved]=await Promise.all([q(`select count(*)::int n from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[]))`,[scope]),q(`select count(*)::int n from risk.risk_treatment rt join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[]))`,[scope]),q(`select count(*)::int n from risk.risk_context rc where ($1::uuid[] is null or rc.organization_id=any($1::uuid[]))`,[scope]),q(`select count(*)::int n from risk.risk_indicator ri join risk.risk_assessment ra on ra.risk_assessment_id=ri.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[]))`,[scope]),q(`select count(*)::int n from risk.risk_assessment ra join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where ra.status='APPROVED' and ($1::uuid[] is null or rc.organization_id=any($1::uuid[]))`,[scope])]);res.json({contexts:c.rows[0].n,risks:a.rows[0].n,indicators:i.rows[0].n,treatments:t.rows[0].n,approved_risks:approved.rows[0].n})}catch(e){res.status(500).json({message:e.message})}});

// =========================
// MONITORING & REVIU - MODUL TERPISAH
// =========================
app.get('/api/monitoring',async(req,res)=>{try{const scope=riskOrgScope(req);res.json((await q(`select rm.risk_monitoring_id,rm.risk_treatment_id,rm.monitoring_date,rm.monitoring_review,rm.actual_risk,rm.trend,rm.reviewed_by,rm.reviewed_at,rt.treatment_plan,rt.target_residual_risk,rt.schedule_date,rt.pic_employee_id,pic.employee_name pic_employee_name,ra.risk_code,ra.risk_description,ra.current_risk,rc.organization_id,o.organization_name from risk.risk_monitoring rm join risk.risk_treatment rt on rt.risk_treatment_id=rm.risk_treatment_id join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id join master.organization o on o.organization_id=rc.organization_id left join master.employee pic on pic.employee_id=rt.pic_employee_id where ($1::uuid[] is null or rc.organization_id=any($1::uuid[])) order by rm.monitoring_date desc,rm.risk_monitoring_id desc`,[scope])).rows)}catch(e){res.status(500).json({message:e.message})}});
app.post('/api/monitoring',async(req,res)=>{const b=req.body||{};if(!b.risk_treatment_id)return res.status(400).json({message:'Perlakuan risiko wajib dipilih'});const canReview=roleHas(req,'MANAJER_RISIKO');const canActual=roleHas(req,'BIDANG_KINERJA_RISIKO');if(!canReview&&!canActual)return res.status(403).json({message:'Anda tidak memiliki kewenangan mengisi Monitoring & Reviu'});if(canReview&&!String(b.monitoring_review||'').trim()&&!canActual)return res.status(400).json({message:'Monitoring & Reviu wajib diisi oleh Manajer Risiko'});if(canActual&&!String(b.actual_risk||'').trim()&&!canReview)return res.status(400).json({message:'Nilai Actual Risk wajib diisi oleh Bidang Pengelolaan Kinerja dan Risiko'});try{const tr=(await q(`select rc.organization_id from risk.risk_treatment rt join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where rt.risk_treatment_id=$1`,[b.risk_treatment_id])).rows[0];if(!tr)return res.status(404).json({message:'Perlakuan Risiko tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(tr.organization_id))return res.status(403).json({message:'Perlakuan Risiko berada di luar unit kerja Anda'});const latest=(await q(`select actual_risk from risk.risk_monitoring where risk_treatment_id=$1 and actual_risk is not null order by monitoring_date desc,risk_monitoring_id desc limit 1`,[b.risk_treatment_id])).rows[0];let trend=null;if(b.actual_risk!==undefined&&b.actual_risk!==null&&b.actual_risk!==''&&latest?.actual_risk!==null){const a=Number(b.actual_risk),p=Number(latest.actual_risk);if(Number.isFinite(a)&&Number.isFinite(p))trend=a<p?'DECREASE':a>p?'INCREASE':'STABLE'}const r=await q(`insert into risk.risk_monitoring(risk_treatment_id,monitoring_date,monitoring_review,actual_risk,trend,reviewed_by,reviewed_at) values($1,$2,$3,$4,$5,$6,$7) returning *`,[b.risk_treatment_id,b.monitoring_date||new Date().toISOString().slice(0,10),canReview?b.monitoring_review||null:null,canActual?b.actual_risk||null:null,trend,canReview?req.user.user_id:null,canReview?new Date():null]);await audit(req,'CREATE','risk.risk_monitoring',r.rows[0].risk_monitoring_id,null,r.rows[0],tr.organization_id);res.status(201).json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});
app.put('/api/monitoring/:id',async(req,res)=>{const b=req.body||{};const canReview=roleHas(req,'MANAJER_RISIKO');const canActual=roleHas(req,'BIDANG_KINERJA_RISIKO');if(!canReview&&!canActual)return res.status(403).json({message:'Tidak memiliki kewenangan'});try{const old=(await q(`select rm.*,rc.organization_id from risk.risk_monitoring rm join risk.risk_treatment rt on rt.risk_treatment_id=rm.risk_treatment_id join risk.risk_assessment ra on ra.risk_assessment_id=rt.risk_assessment_id join risk.risk_context rc on rc.risk_context_id=ra.risk_context_id where rm.risk_monitoring_id=$1`,[req.params.id])).rows[0];if(!old)return res.status(404).json({message:'Data Monitoring & Reviu tidak ditemukan'});const scope=riskOrgScope(req);if(scope&&!scope.includes(old.organization_id))return res.status(403).json({message:'Data berada di luar unit kerja Anda'});let review=old.monitoring_review,actual=old.actual_risk,reviewedBy=old.reviewed_by,reviewedAt=old.reviewed_at;if(canReview&&b.monitoring_review!==undefined){review=b.monitoring_review||null;reviewedBy=req.user.user_id;reviewedAt=new Date()}if(canActual&&b.actual_risk!==undefined)actual=b.actual_risk||null;let trend=old.trend;if(canActual&&b.actual_risk!==undefined){const prev=(await q(`select actual_risk from risk.risk_monitoring where risk_treatment_id=$1 and risk_monitoring_id<>$2 and actual_risk is not null and monitoring_date<=$3 order by monitoring_date desc,risk_monitoring_id desc limit 1`,[old.risk_treatment_id,req.params.id,b.monitoring_date||old.monitoring_date])).rows[0];if(prev?.actual_risk!==null&&actual!==null){const a=Number(actual),p=Number(prev.actual_risk);trend=Number.isFinite(a)&&Number.isFinite(p)?(a<p?'DECREASE':a>p?'INCREASE':'STABLE'):null}else trend=null}const r=await q(`update risk.risk_monitoring set monitoring_date=$1,monitoring_review=$2,actual_risk=$3,trend=$4,reviewed_by=$5,reviewed_at=$6 where risk_monitoring_id=$7 returning *`,[b.monitoring_date||old.monitoring_date,review,actual,trend,reviewedBy,reviewedAt,req.params.id]);await audit(req,'UPDATE','risk.risk_monitoring',req.params.id,old,r.rows[0],old.organization_id);res.json(r.rows[0])}catch(e){res.status(400).json({message:e.message})}});

const port=Number(process.env.PORT||4000);
// Canonical Strategic Objective master for Manual IKU.
// The endpoint is idempotent: existing code/name is reused, otherwise a new master row is created.
app.post("/api/performance/strategic-objectives/resolve", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, code } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanCode = String(code || "").trim() || null;

    if (!cleanName) {
      return res.status(400).json({ error: "Nama sasaran strategis wajib diisi." });
    }

    await client.query("BEGIN");

    // Prefer an exact code match when supplied.
    let found = null;
    if (cleanCode) {
      const byCode = await client.query(
        `SELECT strategic_objective_id, code, name
           FROM planning.strategic_objective
          WHERE code = $1
          LIMIT 1`,
        [cleanCode]
      );
      found = byCode.rows[0] || null;
    }

    // Otherwise reuse an exact name within the selected period when possible.
    if (!found) {
      const byName = await client.query(
        `SELECT strategic_objective_id, code, name
           FROM planning.strategic_objective
          WHERE lower(trim(name)) = lower(trim($1))
          ORDER BY strategic_objective_id
          LIMIT 1`,
        [cleanName]
      );
      found = byName.rows[0] || null;
    }

    if (found) {
      await client.query("COMMIT");
      return res.json({ ...found, created: false });
    }

    const inserted = await client.query(
      `INSERT INTO planning.strategic_objective (code, name)
       VALUES ($1, $2)
       RETURNING strategic_objective_id, code, name`,
      [cleanCode, cleanName]
    );

    await client.query("COMMIT");
    return res.status(201).json({ ...inserted.rows[0], created: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Resolve strategic objective error:", err);
    return res.status(500).json({ message: err.message || "Gagal menyimpan sasaran strategis.", error: err.message || "Gagal menyimpan sasaran strategis." });
  } finally {
    client.release();
  }
});

ensureRuntimeSchema()
  .then(()=>app.listen(port,()=>console.log(`SIMONIK BE listening on ${port}`)))
  .catch((e)=>{
    console.error('SIMONIK BE database initialization failed:', e.message);
    process.exit(1);
  });
