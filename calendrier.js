/* Bon Point — calendrier de proposition en heure de Paris.
 * La disponibilité affichée est indicative jusqu'à confirmation administrative.
 * Si la consultation du Worker est indisponible, la proposition par mail
 * reste possible, mais ne prétend pas vérifier la disponibilité en direct.
 */
(function(){
'use strict';
const zone='Europe/Paris';
const dateParts=d=>{
 const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const v=n=>parts.find(p=>p.type===n)?.value;
 return v('year')+'-'+v('month')+'-'+v('day');
};
const isoDate=(y,m,d)=>new Date(Date.UTC(y,m-1,d,12));
const localParts=s=>s.split('-').map(Number);
const dayOfWeek=s=>isoDate(...localParts(s)).getUTCDay();
const two=n=>String(n).padStart(2,'0');
const addDays=(s,n)=>{const [y,m,d]=localParts(s),t=isoDate(y,m,d+n);return t.getUTCFullYear()+'-'+two(t.getUTCMonth()+1)+'-'+two(t.getUTCDate())};
const today=dateParts(new Date()),first=addDays(today,3),last=addDays(today,90);
const root=document.getElementById('calendar'),monthLabel=document.getElementById('calendarMonth'),dateEl=document.getElementById('date'),slots=document.getElementById('slots'),timeEl=document.getElementById('time'),hint=document.getElementById('calendarHint'),kindEl=document.getElementById('sessionType');
const [fy,fm]=localParts(first);let viewY=fy,viewM=fm,selected='',chosen='',generation=0,availability=null;
const title=s=>new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(isoDate(...localParts(s)));
const canPick=s=>s>=first&&s<=last;
function schedule(s,kind=kindEl.value){
 const n=dayOfWeek(s),result=[];
 const duration=kind==='course'?60:20;
 let start=18*60,end=22*60;
 if(n===4)start=13*60+30;
 else if(n===0||n===6){start=8*60;end=18*60}
 for(let min=start;min+duration<=end;min+=30)result.push(two(Math.floor(min/60))+':'+two(min%60));
 return result;
}
function render(){
 const month=`${viewY}-${two(viewM)}-01`;monthLabel.textContent=title(month);root.replaceChildren();
 ['L','M','M','J','V','S','D'].forEach(n=>{const el=document.createElement('span');el.className='cal-weekday';el.textContent=n;root.append(el)});
 const offset=(dayOfWeek(month)+6)%7;
 for(let i=0;i<offset;i++){const filler=document.createElement('span');filler.className='cal-filler';root.append(filler)}
 const days=new Date(Date.UTC(viewY,viewM,0)).getUTCDate();
 for(let d=1;d<=days;d++){
  const s=`${viewY}-${two(viewM)}-${two(d)}`,button=document.createElement('button');
  button.type='button';button.className='cal-date';button.textContent=d;button.disabled=!canPick(s);
  button.setAttribute('aria-label',new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'UTC'}).format(isoDate(...localParts(s))));
  button.setAttribute('aria-pressed',String(s===selected));if(s===selected)button.classList.add('selected');
  button.addEventListener('click',()=>select(s));root.append(button);
 }
 document.getElementById('prevMonth').disabled=viewY<fy||(viewY===fy&&viewM<=fm);
 const [ly,lm]=localParts(last);document.getElementById('nextMonth').disabled=viewY>ly||(viewY===ly&&viewM>=lm);
}
function choose(value){
 chosen=value;timeEl.value=value;
 slots.querySelectorAll('.slot').forEach(b=>{const on=b.dataset.hour===value;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on))});
 hint.textContent='Créneau proposé : '+selected.split('-').reverse().join('/')+' à '+value+' (heure de Paris). La réservation nécessite une confirmation.';
}
function drawSlots(){
 slots.replaceChildren();
 const options=schedule(selected),known=availability?.slots||null;
 const blocked=new Set(known?.filter(v=>!v.available).map(v=>v.time)||[]);
 for(const hour of options){
  const b=document.createElement('button');b.type='button';b.className='slot';b.dataset.hour=hour;
  const busy=blocked.has(hour);b.disabled=busy;b.textContent=busy?hour+' · occupé':hour;
  b.setAttribute('aria-pressed',String(hour===chosen));if(hour===chosen)b.classList.add('selected');
  b.setAttribute('aria-label',hour+(busy?', créneau occupé':', proposer cet horaire'));
  if(!busy)b.addEventListener('click',()=>choose(hour));
  slots.append(b);
 }
 if(chosen&&blocked.has(chosen)){chosen='';timeEl.value=''}
 if(!chosen)hint.textContent=known?
  'Les horaires marqués « occupé » sont déjà réservés. Les autres restent soumis à validation manuelle.':
  'Les heures proposées sont indicatives. Vérification des créneaux occupés indisponible pour le moment.';
}
async function refreshAvailability(){
 if(!selected)return;const token=++generation,date=selected,kind=kindEl.value;
 availability=null;drawSlots();hint.textContent='Vérification des créneaux occupés…';
 const endpoint=window.BonpointSite?.API;
 if(!endpoint){drawSlots();return}
 const ctl=new AbortController();
 const deadline=setTimeout(()=>ctl.abort(),6500);
 try{
  const url=endpoint+'/api/site/slots?date='+encodeURIComponent(date)+'&session_type='+encodeURIComponent(kind);
  const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store',signal:ctl.signal});
  if(!response.ok)throw Error('preview-unavailable');
  const data=await response.json();
  if(token!==generation||selected!==date||kindEl.value!==kind)return;
  availability=data;drawSlots();
 }catch(_err){
  if(token!==generation||selected!==date||kindEl.value!==kind)return;
  availability=null;drawSlots();
 }finally{clearTimeout(deadline)}
}
function select(s){
 if(!canPick(s))return;
 selected=s;chosen='';availability=null;dateEl.value=s;timeEl.value='';
 render();drawSlots();refreshAvailability();
}
document.getElementById('prevMonth').addEventListener('click',()=>{viewM--;if(viewM<1){viewM=12;viewY--}render()});
document.getElementById('nextMonth').addEventListener('click',()=>{viewM++;if(viewM>12){viewM=1;viewY++}render()});
kindEl.addEventListener('change',()=>{if(selected)select(selected)});
window.BonpointSlots={schedule,dayOfWeek,canPick,addDays,
 selection:()=>({date:selected,time:chosen}),
 reset:()=>{generation++;availability=null;selected='';chosen='';dateEl.value='';timeEl.value='';slots.replaceChildren();hint.textContent='Sélectionnez une date dans le calendrier.';render()}
};
render();
})();
