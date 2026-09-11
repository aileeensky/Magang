"use client";
import { useMemo, useState } from "react";
import type { Org, Context, RiskReferences } from "../../../types";
import { Card, Field, PageTitle, DataTable } from "../../ui";

export default function ContextPage({orgs,refs,form,setForm,data,create,onSelect,submitSelected,canAuthor,canReview,canApprove}:{orgs:Org[];refs:RiskReferences;form:any;setForm:(x:any)=>void;data:Context[];create:()=>void;onSelect:(id:string)=>void;submitSelected:(ids:string[])=>void;canAuthor:boolean;canReview:boolean;canApprove:boolean}) {
 const [year,setYear]=useState(String(new Date().getFullYear())),[selected,setSelected]=useState<string[]>([]);
 const ikus=refs.performance_ikus.filter(x=>String(x.year)===year);
 const rows=useMemo(()=>data.filter(x=>!year||String((x as any).performance_iku_year||"")===year),[data,year]);
 const toggle=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
 return <section>
  <PageTitle icon="bi-diagram-3" title="Lingkup, Konteks & Kriteria" subtitle="LKK disusun dari Manual IKU yang telah disetujui kedua pihak."/>
  <div className="grid-2">
   <Card title="Form LKK">
    <form onSubmit={e=>{e.preventDefault();create()}}>
     <Field label="Unit Kerja"><select required value={form.organization_id} onChange={e=>setForm({...form,organization_id:e.target.value})}>{orgs.map(o=><option key={o.organization_id} value={o.organization_id}>{o.organization_name}</option>)}</select></Field>
     <Field label="Sasaran Strategis"><select value={form.strategic_objective_id||""} onChange={e=>setForm({...form,strategic_objective_id:e.target.value})}><option value="">Pilih Sasaran Strategis</option>{Array.from(new Map(ikus.map(x=>[(x as any).strategic_objective_name,(x as any).strategic_objective_name])).entries()).filter(([k])=>k).map(([k])=><option key={k as string} value={k as string}>{k as string}</option>)}</select></Field>
     <Field label="Manual IKU disetujui"><select required value={form.performance_iku_id||""} onChange={e=>{const i=ikus.find(x=>x.iku_id===e.target.value);setForm({...form,performance_iku_id:e.target.value,strategic_objective_id:(i as any)?.strategic_objective_name||""})}}><option value="">Pilih Manual IKU</option>{ikus.filter(x=>!form.strategic_objective_id||((x as any).strategic_objective_name===form.strategic_objective_id)).map(x=><option key={x.iku_id} value={x.iku_id}>{(x as any).strategic_objective_name||"SS"} — {x.indicator_name}</option>)}</select></Field>
     <Field label="Rincian Output / Komponen"><input type="text" value={form.output_detail||""} onChange={e=>setForm({...form,output_detail:e.target.value})}/></Field>
     <Field label="Proses Bisnis"><input type="text" value={form.business_process_detail||""} onChange={e=>setForm({...form,business_process_detail:e.target.value})}/></Field>
     <Field label="Konteks Eksternal"><textarea value={form.external_context||""} onChange={e=>setForm({...form,external_context:e.target.value})}/></Field>
     <Field label="Konteks Internal"><textarea value={form.internal_context||""} onChange={e=>setForm({...form,internal_context:e.target.value})}/></Field>
     <button className="btn-primary">Simpan Draft</button>
    </form>
   </Card>
   <Card title="Daftar LKK">
    <Field label="Filter Tahun"><input type="number" value={year} onChange={e=>setYear(e.target.value)}/></Field>
    <DataTable headers={["Pilih","Unit","Sasaran Strategis","Manual IKU","Output","Proses Bisnis","Konteks Internal","Konteks Eksternal","Status","Detail"]} rows={rows.map(c=>[
      <input type="checkbox" checked={selected.includes(c.risk_context_id)} disabled={c.status!=="DRAFT"&&c.status!=="REJECTED"} onChange={e=>{e.stopPropagation();toggle(c.risk_context_id)}} key={c.risk_context_id}/>,
      c.organization_name||"—",c.strategic_objective_name||"—",c.performance_iku_name||"—",c.output_detail||c.performance_output_name||"—",c.business_process_detail||c.business_process_name||"—",c.internal_context||"—",c.external_context||"—",
      <span className={`badge ${String(c.status).toLowerCase()}`} key={c.risk_context_id+"s"}>{c.status}</span>,
      <button type="button" onClick={()=>onSelect(c.risk_context_id)} key={c.risk_context_id+"d"}>Detail</button>
    ])}/>
    {canAuthor&&<div className="status-actions" style={{marginTop:16}}><button type="button" className="btn-primary" disabled={!selected.length} onClick={()=>{submitSelected(selected);setSelected([])}}>Ajukan</button></div>}
   </Card>
  </div>
 </section>
}
