"use client";
import { useEffect } from "react";

const actions: Array<[RegExp,string,string,string]> = [
 [/^simpan draft$/i,"bi-save","Simpan Draft","success"],
 [/^(simpan|buat|tambah)/i,"bi-plus-lg","Simpan","primary"],
 [/^(edit|ubah|perbarui)/i,"bi-pencil-square","Edit","warning"],
 [/^(hapus|ajukan hapus)/i,"bi-trash","Hapus","danger"],
 [/^(detail|lihat)/i,"bi-eye","Detail","secondary"],
 [/^(setuju|setujui|tetapkan|approve)/i,"bi-check-lg","Setujui","success"],
 [/^(tolak|reject)/i,"bi-x-lg","Tolak","danger"],
 [/^(reviu|review)/i,"bi-search","Reviu","primary"],
 [/^(ajukan|submit)/i,"bi-send","Ajukan","primary"],
 [/^(batal|tutup|cancel)/i,"bi-x-circle","Batal","secondary"],
 [/^(pilih semua)/i,"bi-check2-square","Pilih Semua","secondary"],
 [/^(batal pilih)/i,"bi-x-square","Batal Pilih","secondary"],
 [/^(login|masuk)/i,"bi-box-arrow-in-right","Masuk","primary"],
 [/^(logout|keluar)/i,"bi-box-arrow-right","Keluar","danger"],
 [/^(download|unduh)/i,"bi-download","Unduh","primary"],
 [/^(upload|unggah)/i,"bi-upload","Unggah","primary"],
 [/^(cari|search)/i,"bi-search","Cari","primary"],
 [/^(reset|bersihkan)/i,"bi-arrow-counterclockwise","Reset","secondary"],
];

function enhance(){
 document.querySelectorAll<HTMLButtonElement>("button").forEach(btn=>{
   if(btn.dataset.enhanced === "1") return;
   const label=(btn.getAttribute("aria-label")||btn.textContent||"").replace(/▾/g,"").trim().replace(/\\s+/g," ");
   if(!label) return;
   if(!btn.title) btn.title=label;
   const hasIcon=!!btn.querySelector("i.bi");
   if(hasIcon){btn.dataset.enhanced="1";return;}
   const match=actions.find(([re])=>re.test(label));
   if(match){
     btn.classList.add(`btn-action-${match[3]}`);
     const icon=document.createElement("i");
     icon.className=`bi ${match[1]}`;
     icon.setAttribute("aria-hidden","true");
     btn.prepend(icon);
     btn.dataset.enhanced="1";
   }
 });
}

export default function ButtonEnhancer(){
 useEffect(()=>{
   enhance();
   const observer=new MutationObserver(()=>enhance());
   observer.observe(document.body,{subtree:true,childList:true});
   return()=>observer.disconnect();
 },[]);
 return null;
}
