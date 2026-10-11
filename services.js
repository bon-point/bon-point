/* Scripts communs aux formulaires Bon Point : le navigateur n'enregistre pas de dossier d'élève. */
(function(){
 'use strict';
 const API=String(window.BONPOINT_CHECKOUT_API||'').replace(/\/$/,'');
 const MAX=12000;
 function field(form,name){return String(new FormData(form).get(name)||'').trim();}
 function mail(subject,lines){
   const url='mailto:soutien.bonpoint@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(lines.join('\n'));
   location.href=url;
 }
 function show(el,message,type){if(!el)return;el.textContent=message;el.className='status '+(type||'');}
 async function status(){
   if(!API)return {intake:false,parent_portal:false};
   try{const ctl=new AbortController();const timeout=setTimeout(()=>ctl.abort(),5000);const r=await fetch(API+'/api/site/status',{signal:ctl.signal});clearTimeout(timeout);if(!r.ok)throw Error('offline');return await r.json();}
   catch{return {intake:false,parent_portal:false};}
 }
 window.BonpointSite={API,MAX,field,mail,show,status};
})();
