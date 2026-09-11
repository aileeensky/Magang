'use client';
import { useState } from 'react';

export default function CrudModal({modal,onClose}:{modal:{type:'confirm'|'success'|'error';title:string;message:string;confirmText?:string;onConfirm?:()=>Promise<void>|void};onClose:()=>void}){
 const [busy,setBusy]=useState(false);
 const confirm=async()=>{if(!modal.onConfirm)return;setBusy(true);try{await modal.onConfirm()}finally{setBusy(false)}};
 const isConfirm=modal.type==='confirm';
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
   <div className={`modal-card modal-${modal.type}`} role="dialog" aria-modal="true" aria-labelledby="crud-modal-title">
     <div className="modal-icon"><i className={`bi ${isConfirm?'bi-question-circle':modal.type==='success'?'bi-check-circle':'bi-exclamation-triangle'}`}/></div>
     <div className="modal-content">
       <h3 id="crud-modal-title">{modal.title}</h3>
       <p>{modal.message}</p>
     </div>
     <div className="modal-actions">
       {isConfirm&&<button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Batal</button>}
       <button type="button" className={isConfirm?'btn-primary':'btn-primary'} disabled={busy} onClick={isConfirm?confirm:onClose}>
         {busy?<><i className="bi bi-arrow-repeat spin"/> Memproses…</>:isConfirm?(modal.confirmText||'Konfirmasi'):'Tutup'}
       </button>
     </div>
   </div>
 </div>
}
