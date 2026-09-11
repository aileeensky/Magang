"use client";
import { useMemo, useState } from "react";
import type { Iku, Org, Pk, AuthUser } from "../../../types";
import { Card, Field, PageTitle, DataTable } from "../../ui";

const fmt=(v:any)=>{
 if(v===null||v===undefined||v==="") return "—";
 const n=Number(v);
 return Number.isFinite(n) ? String(Number(n.toFixed(6))) : String(v);
};

const annualTarget=(x:any)=>{
 const values=[x.target_tw1,x.target_tw2,x.target_tw3,x.target_tw4].map((v:any)=>{
   const n=Number(v);
   return Number.isFinite(n)?n:0;
 });
 const mode=String(x.period_consolidation||"SUM").toUpperCase();
 let result:number;
 if(mode==="AVERAGE") result=values.reduce((a:number,b:number)=>a+b,0)/4;
 else if(mode==="TAKE_LAST_KNOWN") result=values[3];
 else result=values.reduce((a:number,b:number)=>a+b,0);
 return fmt(result);
};

const targetWithUnit=(x:any)=>{
 const value=annualTarget(x);
 const unit=String(x.measurement_unit||"").trim();
 return unit && value!=="—" ? (unit==="%" ? `${value}%` : `${value} (${unit})`) : value;
};

export default function PkPage({orgs,ikus,data,user,submitBulk,confirmBulk}:{
 orgs:Org[];ikus:Iku[];data:Pk[];user:AuthUser|null;
 submitBulk:(year:number)=>Promise<void>;
 confirmBulk:(year:number)=>Promise<void>;
}) {
 const [year,setYear]=useState(String(new Date().getFullYear()));
 const rows=useMemo(()=>data.filter(x=>!year||String(x.year)===year),[data,year]);
 const roleCodes=new Set((user?.roles||[]).map(r=>String(r.role_code||"").trim().toUpperCase().replace(/[\s-]+/g,"_")));
 const isManager=roleCodes.has("MANAJER_KINERJA");
 const isLeader=roleCodes.has("PIMPINAN_UNIT");
 const level=String(orgs.find(o=>o.organization_id===user?.organization_id)?.organization_level||"").toUpperCase();
 const isUkeII=isLeader&&level==="UKE_II";
 const isUkeI=isLeader&&level==="UKE_I";
 const canSubmit=rows.some(x=>["DRAFT","REJECTED","APPROVED"].includes(String(x.perjanjian_kinerja_status).toUpperCase()));
 const canConfirm=isUkeII ? rows.some(x=>String(x.perjanjian_kinerja_status).toUpperCase()==="SUBMITTED") : isUkeI ? rows.some(x=>String(x.perjanjian_kinerja_status).toUpperCase()==="REVIEWED") : false;
const actionLabel=isUkeII?"Konfirmasi Perjanjian Kinerja UKE II":"Konfirmasi Perjanjian Kinerja UKE I";
  const statusCount=(s:string)=>rows.filter(x=>String(x.perjanjian_kinerja_status||"").toUpperCase()===s).length;
  const tracking=[["DRAFT","Draft"],["SUBMITTED","Diajukan"],["REVIEWED","Direviu"],["APPROVED","Disetujui"],["REJECTED","Ditolak"]].map(([code,label])=>({code,label,count:statusCount(String(code))}));
  return <section>
   <PageTitle icon="bi-file-earmark-check" title="Perjanjian Kinerja" subtitle="Daftar Perjanjian Kinerja berdasarkan tahun. Pengajuan dan konfirmasi dilakukan sekaligus untuk seluruh data pada tahun yang dipilih."/>
   <Card title="Daftar Perjanjian Kinerja">
    <div className="form-row">
     <Field label="Filter Tahun"><input type="number" value={year} onChange={e=>setYear(e.target.value)}/></Field>
    </div>
    <div className="pk-tracking" aria-label="Tracking status Perjanjian Kinerja">
     {tracking.map(t=>(
      <div className={`pk-track-item ${t.code.toLowerCase()}`} key={t.code}>
       <b>{t.count}</b>
       <span>{t.label}</span>
      </div>
     ))}
    </div>
   <DataTable
    headers={["No.","Unit Kerja","Sasaran Strategis","Indikator Kinerja","Target","Status"]}
    rows={rows.map((x:any,i:number)=>[
      i+1,
      x.organization_name||"—",
      x.strategic_objective_name||"—",
      x.indicator_name||x.iku_id||"—",
      targetWithUnit(x),
      <span className={`badge ${String(x.perjanjian_kinerja_status).toLowerCase()}`} key={x.agreement_id}>{x.perjanjian_kinerja_status}</span>
    ])}
   />
   <div className="status-actions" style={{marginTop:16,justifyContent:'flex-end'}}>
    {isManager&&<button type="button" className="btn-primary" disabled={!canSubmit} onClick={()=>submitBulk(Number(year))}>Ajukan</button>}
    {(isUkeII||isUkeI)&&<button type="button" className="btn-primary" disabled={!canConfirm} onClick={()=>confirmBulk(Number(year))}>{actionLabel}</button>}
   </div>
  </Card>
 </section>
}
