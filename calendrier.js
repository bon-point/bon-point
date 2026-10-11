/* Bon Point — calendrier des horaires de demande (Europe/Paris).
 * Horaires INDICATIFS : aucun agenda en direct n'est connecté.
 * Le serveur doit revérifier chaque créneau et le délai de prévenance.
 */
(function(){
'use strict';
const zone='Europe/Paris';
const dateParts=(d)=>{const p=new Intl.DateTimeFormat('fr-FR',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const v=n=>p.find(x=>x.type===n)?.value;return v('year')+'-'+v('month')+'-'+v('day')};
const isoDate=(y,m,d)=>new Date(Date.UTC(y,m-1,d,12));
const localParts=s=>s.split('-').map(Number);
const dayOfWeek=s=>{const [y,m,d]=localParts(s);return isoDate(y,m,d).getUTCDay()};
const two=n=>String(n).padStart(2,'0');
const addDays=(s,n)=>{const [y,m,d]=localParts(s);const t=isoDate(y,m,d+n);return t.getUTCFullYear()+'-'+two(t.getUTCMonth()+1)+'-'+two(t.getUTCDate())};
const today=dateParts(new Date());
const first=addDays(today,3); // Marge conservatrice supérieure à 48 h.
const last=addDays(today,90);
function schedule(s,kind=document.getElementById('sessionType')?.value||'intro'){
const day=dayOfWeek(s),result=[];
let start=18*60,end=21*60;
if(day===4){start=13*60+30;end=21*60}
else if(day===0||day===6){start=8*60;end=18*60-(kind==='course'?60:20)}
for(let i=start;i<=end;i+=30)result.push(two(Math.floor(i/60))+':'+two(i%60));
return result;
}
const root=document.getElementById('calendar'),output=document.getElementById('calendarMonth'),dateEl=document.getElementById('date'),slots=document.getElementById('slots'),timeEl=document.getElementById('time'),hint=document.getElementById('calendarHint');
const [fy,fm]=localParts(first);let viewY=fy,viewM=fm,selected='',chosen='';
const title=s=>new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(isoDate(...localParts(s)));
const canPick=s=>s>=first&&s<=last;
function render(){
const monthStart=`${viewY}-${two(viewM)}-01`;
output.textContent=title(monthStart);
root.replaceChildren();
const weekdays=['L','M','M','J','V','S','D'];
weekdays.forEach(name=>{let el=document.createElement('span');el.className='cal-weekday';el.textContent=name;root.append(el)});
const padding=(dayOfWeek(monthStart)+6)%7;
for(let i=0;i<padding;i++){let filler=document.createElement('span');filler.className='cal-filler';root.append(filler)}
const lastDay=new Date(Date.UTC(viewY,viewM,0)).getUTCDate();
for(let day=1;day<=lastDay;day++){
const s=`${viewY}-${two(viewM)}-${two(day)}`,button=document.createElement('button');
button.type='button';button.className='cal-date';button.textContent=day;button.disabled=!canPick(s);
button.setAttribute('aria-label',new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'UTC'}).format(isoDate(...localParts(s))));
button.setAttribute('aria-pressed',String(s===selected));if(s===selected)button.classList.add('selected');
button.addEventListener('click',()=>select(s));root.append(button);
}
document.getElementById('prevMonth').disabled=(viewY<fy||(viewY===fy&&viewM<=fm));
const [ly,lm]=localParts(last);document.getElementById('nextMonth').disabled=viewY>ly||(viewY===ly&&viewM>=lm);
}
function select(s){selected=s;chosen='';dateEl.value=s;timeEl.value='';render();slots.replaceChildren();
for(const value of schedule(s)){const b=document.createElement('button');b.type='button';b.className='slot';b.textContent=value;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{timeEl.value=value;chosen=value;slots.querySelectorAll('button').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});hint.textContent='Créneau proposé : '+s.split('-').reverse().join('/')+' à '+value+' (heure de Paris). En attente de confirmation.'});slots.append(b)}
hint.textContent='Choisissez une heure. Ce ne sont pas des créneaux confirmés, seulement vos disponibilités habituelles.';
}
document.getElementById('prevMonth').addEventListener('click',()=>{viewM--;if(viewM<1){viewM=12;viewY--}render()});
document.getElementById('nextMonth').addEventListener('click',()=>{viewM++;if(viewM>12){viewM=1;viewY++}render()});
document.getElementById('sessionType').addEventListener('change',()=>{if(selected)select(selected)});
document.getElementById('customTime').addEventListener('input',e=>{const value=e.target.value;timeEl.value=value;chosen=value;slots.querySelectorAll('button').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false')});hint.textContent='Horaire personnalisé proposé : '+value+'. Nous vérifierons sa compatibilité.'});
window.BonpointSlots={schedule,dayOfWeek,canPick,addDays,selection:()=>({date:selected,time:chosen}),reset:()=>{selected='';chosen='';dateEl.value='';timeEl.value='';slots.replaceChildren();hint.textContent='Sélectionnez une date dans le calendrier.';render()}};
render();
})();
