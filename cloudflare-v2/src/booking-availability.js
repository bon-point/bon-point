/**
 * Créneaux Bon Point : prévisualisation sans informations personnelles.
 * Le professeur n'a qu'un seul planning, même avec deux salles Discord :
 * les deux salles ne représentent pas deux professeurs disponibles.
 */
export const BUFFER_MINUTES=10;
export const SESSION_DURATION_MINUTES=Object.freeze({intro:20,course:60});
export function slotsOverlap(aStart,aKind,bStart,bKind,bufferMinutes=BUFFER_MINUTES){
 const a=Date.parse(aStart),b=Date.parse(bStart);
 const ad=SESSION_DURATION_MINUTES[aKind],bd=SESSION_DURATION_MINUTES[bKind];
 if(!Number.isFinite(a)||!Number.isFinite(b)||!ad||!bd)return true; // fail closed
 return a < b+(bd+bufferMinutes)*60_000 && b < a+(ad+bufferMinutes)*60_000;
}
export function freeFromConflicts(iso,kind,confirmed=[]){
 return confirmed.every(row=>!slotsOverlap(iso,kind,row.starts_at_utc,row.session_type||'intro'));
}
export function parisSlotTimes(date,kind,parisToUTC,validSlot){
 const out=[];
 if(!SESSION_DURATION_MINUTES[kind])return out;
 for(let mins=9*60;mins<20*60;mins+=30){
  const time=String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');
  const iso=validSlot(date,time,kind);
  if(iso&&parisToUTC(date,time)===iso)out.push({time,starts_at_utc:iso});
 }
 return out;
}
export function slotPreview(date,kind,confirmed,parisToUTC,validSlot){
 return parisSlotTimes(date,kind,parisToUTC,validSlot).map(({time,starts_at_utc})=>({
  time,available:freeFromConflicts(starts_at_utc,kind,confirmed)
 }));
}
