/* Formulaires Bon Point : aucun stockage local de dossier personnel.
 * Si le navigateur n'a pas de logiciel e-mail, le parent peut recopier
 * lui-même le message ; rien n'est transmis par ce mode de secours.
 */
(function(){
 'use strict';
 const API=String(window.BONPOINT_CHECKOUT_API||'').replace(/\/$/,'');
 const MAX=12000;
 function field(form,name){return String(new FormData(form).get(name)||'').trim();}
 function show(el,message,type){if(!el)return;el.textContent=message;el.className='status '+(type||'');}
 function mail(subject,lines,statusEl){
   const address='soutien.bonpoint@gmail.com';
   const body=lines.join('\n');
   // Rendre la demande accessible même sans logiciel e-mail configuré.
   // Ne jamais utiliser innerHTML pour les informations saisies par le parent.
   if(statusEl){
     const prev=statusEl.nextElementSibling;
     if(prev?.classList?.contains('mail-backup'))prev.remove();
     const section=document.createElement('section');
     section.className='notice mail-backup';
     section.setAttribute('aria-label','Alternative à la messagerie');
     const heading=document.createElement('strong');
     heading.textContent='Votre messagerie ne s’ouvre pas ?';
     const instructions=document.createElement('p');
     instructions.textContent='Copiez ce message et envoyez-le vous-même à '+address+'. Tant que vous ne l’avez pas envoyé, Bon Point n’a reçu aucune demande.';
     const area=document.createElement('textarea');
     area.readOnly=true;
     area.className='mail-backup-text';
     area.setAttribute('aria-label','Message à copier et envoyer par e-mail');
     area.value='À : '+address+'\nObjet : '+subject+'\n\n'+body;
     const button=document.createElement('button');
     button.type='button';button.className='btn secondary';button.textContent='Copier le message';
     const result=document.createElement('span');result.className='quiet';result.setAttribute('role','status');
     button.addEventListener('click',async()=>{
       try{
         if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
         await navigator.clipboard.writeText(area.value);
         result.textContent='Message copié. Collez-le dans votre messagerie puis envoyez-le.';
       }catch{
         area.focus();area.select();
         result.textContent='Texte sélectionné : copiez-le manuellement puis envoyez-le par e-mail.';
       }
     });
     const actions=document.createElement('div');actions.className='actions';actions.append(button,result);
     section.append(heading,instructions,area,actions);
     statusEl.after(section);
   }
   location.href='mailto:'+address+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
 }
 async function status(){
   if(!API)return {intake:false,parent_portal:false};
   const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),5000);
   try{
     const r=await fetch(API+'/api/site/status',{signal:ctl.signal,cache:'no-store'});
     if(!r.ok)throw Error('offline');
     return await r.json();
   }catch{return {intake:false,parent_portal:false}}
   finally{clearTimeout(timeout);}
 }
 window.BonpointSite={API,MAX,field,mail,show,status};
})();
