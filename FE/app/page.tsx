'use client';
import { useEffect, useMemo, useState } from 'react';

import type { Org, Ref, StrategicObjective, Context, Assessment, Treatment, Iku, AuthUser, Output, AdminRole, AdminUser, RiskReferences } from '../types';
import IkuPage from '../components/pages/manajemen-kinerja/IkuPage';
import Sidebar from '../components/layout/Sidebar';
import RopnDashboard from '../components/ropn/RopnDashboard';
import CrudModal from '../components/modals/CrudModal';
import LoginScreen from '../components/auth/LoginScreen';
import Dashboard from '../components/dashboard/Dashboard';
import UserManagementPage from '../components/pages/manajemen-pengguna/UserManagementPage';
import PkPage from '../components/pages/manajemen-kinerja/PkPage';
import OutputPage from '../components/pages/manajemen-kinerja/OutputPage';
import ContextPage from '../components/pages/manajemen-risiko/ContextPage';
import AssessmentPage from '../components/pages/manajemen-risiko/AssessmentPage';
import TreatmentPage from '../components/pages/manajemen-risiko/TreatmentPage';
import Placeholder from '../components/pages/perencanaan-strategis/Placeholder';
import MonitoringReviuPage from '../components/pages/monitoring-review/MonitoringReviuPage';
import AccountPage from '../components/pages/account/AccountPage';
import RiskDashboardPage from '../components/pages/manajemen-risiko/RiskDashboardPage';
import IruPage from '../components/pages/manajemen-risiko/IruPage';

const API='/api';
async function api<T>(path:string,options?:RequestInit):Promise<T>{const r=await fetch(`${API}${path}`,{credentials:'include',headers:{'Content-Type':'application/json',...(options?.headers||{})},...options});if(!r.ok){let message='Terjadi kesalahan';try{const x=await r.json();message=x.message||message}catch{message=await r.text()}const error=new Error(message);(error as Error & {status?:number}).status=r.status;throw error}return r.json()}

export default function App(){
 const [tab,setTab]=useState('ropn'); const [collapsed,setCollapsed]=useState(false); const [mobileOpen,setMobileOpen]=useState(false); const [openModules,setOpenModules]=useState<Record<string,boolean>>({planning:false,performance:false,risk:false});
 const [authReady,setAuthReady]=useState(false); const [user,setUser]=useState<AuthUser|null>(null);
 const roleCodes=useMemo(()=>new Set((user?.roles||[]).map(r=>String(r.role_code||'').trim().toUpperCase().replace(/[\s-]+/g,'_'))),[user]);
 const roleNames=useMemo(()=>new Set((user?.roles||[]).map(r=>String(r.role_name||'').trim().toLowerCase())),[user]);
 const hasRole=(code:string,name:string)=>roleCodes.has(code)||roleNames.has(name.toLowerCase());
 const isAdmin=useMemo(()=>{
  const roles=user?.roles||[];
  return roleCodes.has('SUPER_ADMIN') || roles.some(r=>String(r.role_name||'').trim().toLowerCase()==='super admin');
 },[user,roleCodes]);
 const can=(moduleName:'planning'|'performance'|'risk'|'monitoring')=>isAdmin || (moduleName==='planning' && (hasRole('KEPALA_PUSAT_PPSPK','Kepala Pusat Perencanaan Strategis Pemberantasan Korupsi')||hasRole('BIDANG_RENSTRA','Bidang Perencanaan Strategis')||hasRole('PIMPINAN_UNIT','Pimpinan Unit'))) || (moduleName==='performance' && (hasRole('MANAJER_KINERJA','Manajer Kinerja')||hasRole('KEPALA_PUSAT_PPSPK','Kepala Pusat Perencanaan Strategis Pemberantasan Korupsi')||hasRole('BIDANG_RENSTRA','Bidang Perencanaan Strategis')||hasRole('BIDANG_KINERJA_RISIKO','Bidang Pengelolaan Kinerja dan Risiko')||hasRole('PIMPINAN_UNIT','Pimpinan Unit'))) || (moduleName==='risk' && ['MANAJER_RISIKO','KEPALA_PUSAT_PPSPK','BIDANG_KINERJA_RISIKO','PIMPINAN_UNIT'].some(x=>roleCodes.has(x))) || (moduleName==='monitoring' && ['MANAJER_RISIKO','KEPALA_PUSAT_PPSPK','BIDANG_KINERJA_RISIKO','PIMPINAN_UNIT'].some(x=>roleCodes.has(x)));
 useEffect(()=>{const p=new URLSearchParams(window.location.search);const page=p.get('page');if(page)setTab(page);api<{user:AuthUser}>('/auth/me').then(x=>setUser(x.user)).catch(()=>setUser(null)).finally(()=>setAuthReady(true))},[]);
 const [orgs,setOrgs]=useState<Org[]>([]),[cats,setCats]=useState<Ref[]>([]),[strategicObjectives,setStrategicObjectives]=useState<StrategicObjective[]>([]),[riskRefs,setRiskRefs]=useState<RiskReferences>({performance_ikus:[],performance_pks:[],performance_outputs:[],activity_objectives:[],activity_indicators:[],outputs:[],business_processes:[],risk_categories:[],employees:[]}),[contexts,setContexts]=useState<Context[]>([]),[assessments,setAssessments]=useState<Assessment[]>([]),[treatments,setTreatments]=useState<Treatment[]>([]),[riskIndicators,setRiskIndicators]=useState<any[]>([]);
 const [ikus,setIkus]=useState<Iku[]>([]),[pks,setPks]=useState<Pk[]>([]),[outputs,setOutputs]=useState<Output[]>([]),[monitorings,setMonitorings]=useState<any[]>([]);
 const [adminUsers,setAdminUsers]=useState<AdminUser[]>([]),[adminRoles,setAdminRoles]=useState<AdminRole[]>([]); const [loading,setLoading]=useState(true),[error,setError]=useState(''),[selectedContext,setSelectedContext]=useState('');
 const [modal,setModal]=useState<{type:'confirm'|'success'|'error';title:string;message:string;confirmText?:string;onConfirm?:()=>Promise<void>|void}|null>(null);
 const [ikuForm,setIkuForm]=useState<any>({organization_id:'',year:new Date().getFullYear(),strategic_objective_id:'',strategic_objective_text:'',strategic_objective_description:'',indicator_name:'',indicator_description:'',formula:'',measurement_unit:'',data_provider_org_id:'',data_source:'',data_validator_org_id:'',missing_data_action:'',period_consolidation:'SUM',cascading_type:'FULLY',location_consolidation:'SUM',polarization:'MAXIMIZE',reporting_period:'QUARTERLY',renja_type:'',target_tw1:'',target_tw2:'',target_tw3:'',target_tw4:''});
 const [pkForm,setPkForm]=useState<any>({organization_id:'',year:new Date().getFullYear(),iku_id:'',target_tw1:'',target_tw2:'',target_tw3:'',target_tw4:''});
 const [outForm,setOutForm]=useState<any>({organization_id:'',year:new Date().getFullYear(),classification_code:'',output_name:'',output_indicator:'',output_type:'PRIORITAS_NASIONAL',target_value:'',unit:'',component:''});
 const [contextForm,setContextForm]=useState<any>({organization_id:'',strategic_objective_id:'',performance_iku_id:'',output_detail:'',business_process_detail:'',external_context:'',internal_context:''});
 const [monitoringForm,setMonitoringForm]=useState<any>({risk_treatment_id:'',monitoring_date:new Date().toISOString().slice(0,10),monitoring_review:'',actual_risk:''});
 const [assessmentForm,setAssessmentForm]=useState<any>({risk_context_id:'',risk_code:'',risk_description:'',cause:'',impact:'',risk_category_id:'',inherent_risk:'08',existing_control:'',internal_control_index:'0.5'});
 const [treatmentForm,setTreatmentForm]=useState<any>({risk_assessment_id:'',treatment_plan:'',required_resource:'',treatment_index:'0.5',schedule_date:'',pic_employee_id:''});
 const [iruForm,setIruForm]=useState<any>({risk_assessment_id:'',indicator_name:'',value_limit:'',unit:''});
 const reload=async()=>{
  setLoading(true); setError('');
  const emptyRisk:RiskReferences={performance_ikus:[],performance_pks:[],performance_outputs:[],activity_objectives:[],activity_indicators:[],outputs:[],business_processes:[],risk_categories:[],employees:[]};
  try {
    const results=await Promise.allSettled([
      api<Org[]>('/master/organizations'),
      api<Ref[]>('/master/risk-categories'),
      api<StrategicObjective[]>('/master/strategic-objectives')
    ]);
    const o=results[0].status==='fulfilled'&&Array.isArray(results[0].value)?results[0].value:[];
    const c=results[1].status==='fulfilled'&&Array.isArray(results[1].value)?results[1].value:[];
    const so=results[2].status==='fulfilled'&&Array.isArray(results[2].value)?results[2].value:[];
    results.forEach((r,i)=>{if(r.status==='rejected')console.error('Gagal memuat master data',i,r.reason)});
    setOrgs(o); setCats(c); setStrategicObjectives(so);
    const currentOrgId=user?.organization_id || o[0]?.organization_id || '';
    if(currentOrgId){
      setIkuForm((x:any)=>({...x,organization_id:currentOrgId,data_provider_org_id:x.data_provider_org_id||currentOrgId,data_validator_org_id:x.data_validator_org_id||currentOrgId}));
      setPkForm((x:any)=>x.organization_id?x:{...x,organization_id:currentOrgId});
      setOutForm((x:any)=>x.organization_id?x:{...x,organization_id:currentOrgId});
      setContextForm((x:any)=>x.organization_id?x:{...x,organization_id:currentOrgId});
    }
    if(isAdmin){
      const [au,ar]=await Promise.allSettled([api<AdminUser[]>('/admin/users'),api<AdminRole[]>('/admin/roles')]);
      if(au.status==='fulfilled')setAdminUsers(Array.isArray(au.value)?au.value:[]);
      if(ar.status==='fulfilled')setAdminRoles(Array.isArray(ar.value)?ar.value:[]);
    }
    if(can('performance')||tab==='iku'||tab==='pk'||tab==='output'){
      const [i,p,op]=await Promise.allSettled([api<Iku[]>('/performance/iku'),api<Pk[]>('/performance/pks'),api<Output[]>('/performance/outputs')]);
      if(i.status==='fulfilled')setIkus(Array.isArray(i.value)?i.value:[]); else console.error('GET /performance/iku gagal',i.reason);
      if(p.status==='fulfilled')setPks(Array.isArray(p.value)?p.value:[]); else console.error('GET /performance/pks gagal',p.reason);
      if(op.status==='fulfilled')setOutputs(Array.isArray(op.value)?op.value:[]); else console.error('GET /performance/outputs gagal',op.reason);
    }
    if(can('risk')){
      const [rr,ctx,a,t,ri]=await Promise.allSettled([api<RiskReferences>('/risk/references'),api<Context[]>('/risk/contexts'),api<Assessment[]>('/risk/assessments'),api<Treatment[]>('/risk/treatments'),api<any[]>('/risk/indicators')]);
      if(rr.status==='fulfilled')setRiskRefs(rr.value); else console.error('GET /risk/references gagal',rr.reason);
      if(ctx.status==='fulfilled')setContexts(Array.isArray(ctx.value)?ctx.value:[]); else console.error('GET /risk/contexts gagal',ctx.reason);
      if(a.status==='fulfilled')setAssessments(Array.isArray(a.value)?a.value:[]); else console.error('GET /risk/assessments gagal',a.reason);
      if(t.status==='fulfilled')setTreatments(Array.isArray(t.value)?t.value:[]); else console.error('GET /risk/treatments gagal',t.reason);
      if(ri.status==='fulfilled')setRiskIndicators(Array.isArray(ri.value)?ri.value:[]); else console.error('GET /risk/indicators gagal',ri.reason);
    } else { setRiskRefs({...emptyRisk,risk_categories:c}); setRiskIndicators([]); setContexts([]); setAssessments([]); setTreatments([]); }
    if(can('monitoring')){try{setMonitorings(await api<any[]>('/monitoring'))}catch(e){console.error('GET /monitoring gagal',e);setMonitorings([])}} else setMonitorings([]);
  } catch(e){ console.error('Gagal memuat data SIMONIK:',e); setError(e instanceof Error?e.message:'Gagal memuat data'); }
  finally{setLoading(false)}
};
 useEffect(()=>{if(authReady&&user)reload()},[authReady,user]);
 const executeCreate=async(path:string,body:any,after?:()=>void)=>{
  try{
    await api(path,{method:'POST',body:JSON.stringify(body)});
    after?.();
    await reload();
    setError('');
    setModal({type:'success',title:'Berhasil',message:'Perubahan berhasil disimpan.'});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    setError(message);
    setModal({type:'error',title:'Gagal',message});
  }
 };
 const doCreate=(path:string,body:any,after?:()=>void)=>{
   setModal({
     type:'confirm',
     title:'Konfirmasi',
     message:'Apakah Anda yakin ingin menyimpan perubahan ini?',
     confirmText:'Ya, Simpan',
     onConfirm:()=>executeCreate(path,body,after)
   });
 };
 const stats={contexts:contexts.length,risks:assessments.length,treatments:treatments.length,high:assessments.filter(a=>['15','16','20','25'].includes(a.current_risk||'')).length};
 const menu=(id:string)=>{setTab(id);window.history.replaceState({},'',`${window.location.pathname}?page=${encodeURIComponent(id)}`); if(collapsed)setCollapsed(false); setMobileOpen(false)};
 const module=(key:string)=>setOpenModules(x=>({...x,[key]:!x[key]}));
 const logout=()=>{setModal({type:'confirm',title:'Konfirmasi Logout',message:'Apakah Anda yakin ingin keluar dari aplikasi SIMONIK?',confirmText:'Ya, Logout',onConfirm:async()=>{await api('/auth/logout',{method:'POST'});setUser(null);setAuthReady(true);window.history.replaceState({},'',window.location.pathname);window.location.reload()}})};
 if(!authReady)return <LoginScreen onLogin={(u)=>{setUser(u);setAuthReady(true)}}/>;
 if(!user)return <LoginScreen onLogin={(u)=>{setUser(u)}}/>;
 return <div className={`app ${collapsed?'sidebar-collapsed':''}`}>
  <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} active={tab} openModules={openModules} can={can} onSelect={menu} onToggleModule={module} onToggleCollapse={()=>setCollapsed(!collapsed)} onCloseMobile={()=>setMobileOpen(false)} isAdmin={isAdmin} />
  {modal&&<CrudModal modal={modal} onClose={()=>setModal(null)} />}
  <main className="main"><header><button type="button" className="mobile-menu-btn" onClick={()=>setMobileOpen(true)} aria-label="Buka menu navigasi"><i className="bi bi-list"/></button><div><span className="eyebrow">SISTEM MONITORING INFORMASI KINERJA KPK</span><h1>{tab==='ropn'?'Dashboard ROPN':tab==='dashboard'?'Dashboard SIMONIK':tab==='iku'?'Manajemen Kinerja':tab==='pk'?'Perjanjian Kinerja':tab==='output'?'Manajemen Kinerja':tab==='users'?'Manajemen Pengguna':tab==='account'?'Akun Saya':tab==='risk-dashboard'?'Dashboard Manajemen Risiko':tab==='monitoring'?'Monitoring & Reviu':tab==='context'||tab==='assessment'||tab==='iru'||tab==='treatment'?'Manajemen Risiko':'Manajemen Risiko'}</h1><p>Pengelolaan data kinerja dan risiko secara terintegrasi.</p></div><div className="header-actions"><span className="status"><i className="bi bi-circle-fill"/> Sistem aktif</span><div className="user-menu"><div className="avatar">{user.employee_name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="user-meta"><b>{user.employee_name}</b><span>{user.roles[0]?.role_name||user.position_name}</span></div><button className="logout-btn" onClick={logout} title="Keluar" aria-label="Keluar dari SIMONIK"><i className="bi bi-box-arrow-right"/></button></div></div></header>
   {loading&&tab!=='ropn'?<div className="loading-card">Memuat data SIMONIK…</div>:<>
   {tab==='ropn'&&<RopnDashboard/>}
   {tab==='dashboard'&&<Dashboard stats={stats} ikus={ikus} pks={pks} outputs={outputs} risks={assessments} treatments={treatments} setTab={menu}/>} 
   {tab==='iku'&&<IkuPage user={user} orgs={orgs} strategicObjectives={strategicObjectives} form={ikuForm} setForm={setIkuForm} data={ikus} create={()=>doCreate('/performance/iku',{...ikuForm,strategic_objective_id:ikuForm.strategic_objective_id||null},()=>setIkuForm((x:any)=>({...x,renja_type:'',strategic_objective_id:'',indicator_name:'',indicator_description:'',formula:'',measurement_unit:'',data_source:'',missing_data_action:'',target_tw1:'',target_tw2:'',target_tw3:'',target_tw4:''})))} updateStatus={async(id,status,notes)=>{await doCreate(`/performance/iku/${id}/status`,{status,notes})}} submitSelected={async(ids)=>{await doCreate(`/performance/iku/submit-bulk`,{ids})}} update={async(id,body)=>{try{const result=await api(`/performance/iku/${id}`,{method:'PUT',body:JSON.stringify(body)});await reload();setModal({type:'success',title:'Berhasil',message:result?.manual_iku_status==='SUBMITTED'?'Perubahan Manual IKU diajukan ulang untuk validasi Bidang Pengelolaan Kinerja dan Risiko serta Pimpinan Unit.':'Manual IKU diperbarui menjadi draft.'})}catch(e){setModal({type:'error',title:'Gagal',message:e instanceof Error?e.message:String(e)})}}} remove={async(id)=>{const iku=ikus.find((x:any)=>x.iku_id===id);const approved=iku?.manual_iku_status==='APPROVED';setModal({type:'confirm',title:approved?'Ajukan Penghapusan Manual IKU':'Hapus Manual IKU',message:approved?'Manual IKU yang sudah disetujui akan diajukan ke Bidang Pengelolaan Kinerja dan Risiko lalu Pimpinan Unit. Data baru dinonaktifkan setelah kedua validasi menyetujui. Lanjutkan?':iku?.manual_iku_status==='DRAFT'?'Manual IKU Draft akan dihapus permanen dari database. Lanjutkan?':'Manual IKU akan menjadi non-active dan tidak tampil di daftar. Lanjutkan?',confirmText:approved?'Ajukan Hapus':'Ya, Hapus',onConfirm:async()=>{try{const result=await api(`/performance/iku/${id}`,{method:'DELETE'});await reload();setModal({type:'success',title:'Berhasil',message:result?.manual_iku_status==='SUBMITTED'?'Penghapusan diajukan untuk validasi Bidang dan Pimpinan Unit.':result?.deleted?'Manual IKU Draft berhasil dihapus dari database.':'Manual IKU dinonaktifkan.'})}catch(e){setModal({type:'error',title:'Gagal',message:e instanceof Error?e.message:String(e)})}}})}}/>}
   {tab==='pk'&&<PkPage orgs={orgs} ikus={ikus} data={pks} user={user}
      submitBulk={async(year)=>{await doCreate('/performance/pks/submit-bulk',{year},reload)}}
      confirmBulk={async(year)=>{await doCreate('/performance/pks/confirm-bulk',{year},reload)}}/>}
   {tab==='output'&&<OutputPage orgs={orgs} form={outForm} setForm={setOutForm} data={outputs} create={()=>doCreate('/performance/outputs',outForm,()=>setOutForm((x:any)=>({...x,output_name:'',output_indicator:'',component:'',classification_code:'',target_value:''})))} updateStatus={async(id,status)=>{await doCreate(`/performance/outputs/${id}/status`,{status})}}/>}
   {tab==='planning'||tab==='planning-tor'||tab==='planning-work'?<Placeholder title="Perencanaan Strategis" text="Menu disiapkan sebagai referensi modul perencanaan strategis. Implementasi sumber data Renstra/TOR/RAB mengikuti tahap pengembangan berikutnya."/>:null}
   {tab==='risk-dashboard'&&<RiskDashboardPage api={api} setTab={menu}/>}
   {tab==='context'&&<ContextPage orgs={orgs} refs={riskRefs} form={contextForm} setForm={setContextForm} data={contexts} create={()=>doCreate('/risk/contexts',contextForm,()=>setContextForm((x:any)=>({...x,strategic_objective_id:'',performance_iku_id:'',output_detail:'',business_process_detail:'',external_context:'',internal_context:''})))} submitSelected={async(ids)=>{await doCreate('/risk/contexts/submit',{ids})}} canAuthor={isAdmin||roleCodes.has('MANAJER_RISIKO')} canReview={isAdmin||roleCodes.has('BIDANG_KINERJA_RISIKO')} canApprove={isAdmin||roleCodes.has('PIMPINAN_UNIT')||roleCodes.has('KEPALA_PUSAT_PPSPK')} onSelect={(id)=>{setSelectedContext(id);setAssessmentForm((x:any)=>({...x,risk_context_id:id}));setTab('assessment')}}/>}
   {tab==='assessment'&&<AssessmentPage cats={cats} contexts={contexts} form={assessmentForm} setForm={setAssessmentForm} data={assessments} selectedContext={selectedContext} create={()=>doCreate('/risk/assessments',{...assessmentForm,internal_control_index:Number(assessmentForm.internal_control_index)},()=>setAssessmentForm((x:any)=>({...x,risk_description:'',cause:'',impact:'',existing_control:''})))} updateStatus={async(id,status)=>{await doCreate(`/risk/assessments/${id}/status`,{status})}} canAuthor={isAdmin||roleCodes.has('MANAJER_RISIKO')} canReview={isAdmin||roleCodes.has('BIDANG_KINERJA_RISIKO')} canApprove={isAdmin||roleCodes.has('PIMPINAN_UNIT')||roleCodes.has('KEPALA_PUSAT_PPSPK')} onSelect={(id)=>{setTreatmentForm((x:any)=>({...x,risk_assessment_id:id}));setTab('treatment')}}/>}
   {tab==='iru'&&<IruPage assessments={assessments} form={iruForm} setForm={setIruForm} data={riskIndicators} create={()=>doCreate('/risk/indicators',iruForm,()=>setIruForm({risk_assessment_id:'',indicator_name:'',value_limit:'',unit:''}))} updateStatus={async(id,status)=>{await doCreate(`/risk/indicators/${id}/status`,{status})}} canAuthor={isAdmin||roleCodes.has('MANAJER_RISIKO')} canReview={isAdmin||roleCodes.has('BIDANG_KINERJA_RISIKO')} canApprove={isAdmin||roleCodes.has('PIMPINAN_UNIT')||roleCodes.has('KEPALA_PUSAT_PPSPK')}/> }
   {tab==='treatment'&&<TreatmentPage assessments={assessments} employees={riskRefs.employees} form={treatmentForm} setForm={setTreatmentForm} data={treatments} create={()=>doCreate('/risk/treatments',{...treatmentForm,treatment_index:Number(treatmentForm.treatment_index)})} updateStatus={async(id,status)=>{await doCreate(`/risk/treatments/${id}/status`,{status})}} canAuthor={isAdmin||roleCodes.has('MANAJER_RISIKO')} canReview={isAdmin||roleCodes.has('BIDANG_KINERJA_RISIKO')} canApprove={isAdmin||roleCodes.has('PIMPINAN_UNIT')||roleCodes.has('KEPALA_PUSAT_PPSPK')}/>}
   {tab==='monitoring'&&<MonitoringReviuPage treatments={treatments} data={monitorings} form={monitoringForm} setForm={setMonitoringForm} create={()=>doCreate('/monitoring',monitoringForm,()=>setMonitoringForm((x:any)=>({...x,monitoring_review:'',actual_risk:''})))} canReview={isAdmin||roleCodes.has('MANAJER_RISIKO')} canActual={isAdmin||roleCodes.has('BIDANG_KINERJA_RISIKO')}/>}
   {tab==='account'&&<AccountPage user={user} api={api} setUser={setUser}/>}
   {tab==='users'&&isAdmin&&<UserManagementPage users={adminUsers} roles={adminRoles} orgs={orgs} onSaved={reload} setModal={setModal}/>}
   </>}</main></div>
}

