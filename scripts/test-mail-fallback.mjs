import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class FakeElement {
 constructor(tag='div'){
  this.tagName=tag;this.children=[];this.attributes={};this.className='';this.value='';this.textContent='';this.nextElementSibling=null;
  this.classList={contains:(name)=>this.className.split(' ').includes(name)};
 }
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(name,fn){this['on'+name]=fn;}
 append(...children){this.children.push(...children);}
 after(child){this.nextElementSibling=child;}
 remove(){this.removed=true;}
 focus(){this.focused=true;}
 select(){this.selected=true;}
}
const writes=[],requests=[],location={href:''};
const navigator={clipboard:{writeText:async(text)=>{writes.push(text)}}};
const context={
 window:{BONPOINT_CHECKOUT_API:'https://example.test/'},
 navigator,location,
 document:{createElement:(tag)=>new FakeElement(tag)},
 AbortController,setTimeout,clearTimeout,
 FormData,
 fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({intake:false,parent_portal:true})}}
};
vm.runInNewContext(fs.readFileSync('services.js','utf8'),context,{filename:'services.js'});
const helpers=context.window.BonpointSite;
assert.equal(helpers.API,'https://example.test');
const cfg=await helpers.status();
assert.equal(cfg.intake,false);
assert.equal(cfg.parent_portal,true);
assert.equal(requests.length,1);
assert.ok(requests[0].options.signal,'Site status must time out');

const status=new FakeElement('p');
const example='Parent : <img src=x onerror=alert(1)>';
helpers.mail('Demande de cours',[example,'Mathématiques'],status);
const section=status.nextElementSibling;
assert.equal(section.className,'notice mail-backup');
const area=section.children.find(x=>x.tagName==='textarea');
const actions=section.children.find(x=>x.className==='actions');
assert.ok(area.readOnly,'Email draft must not be accidentally edited in preview');
assert.ok(area.value.includes(example),'Original text must remain faithfully copyable');
assert.ok(area.value.includes('À : soutien.bonpoint@gmail.com'));
assert.ok(location.href.startsWith('mailto:soutien.bonpoint@gmail.com?subject='));
assert.ok(location.href.includes('Demande%20de%20cours'));
assert.equal(section.children.some(x=>typeof x.innerHTML==='string'),false,'User input must never be inserted as HTML');

const copyButton=actions.children.find(x=>x.tagName==='button');
await copyButton.onclick();
assert.deepEqual(writes,[area.value]);
assert.match(actions.children.at(-1).textContent,/copié/i);

delete navigator.clipboard;
helpers.mail('Autre demande',['Physique'],status);
assert.ok(section.removed,'Old preview should be replaced, not duplicated');
const newSection=status.nextElementSibling;
const newArea=newSection.children.find(x=>x.tagName==='textarea');
const newButton=newSection.children.find(x=>x.className==='actions').children[0];
await newButton.onclick();
assert.ok(newArea.selected,'The browser should select text if clipboard permission is denied');

const pages=['index.html','reserver.html','diagnostic.html'];
for(const path of pages){
 const html=fs.readFileSync(path,'utf8');
 assert.ok(html.includes('services.js'),'Fallback library must be loaded: '+path);
 assert.match(html,/BonpointSite\.mail\(|B\.mail\(/,'Fallback must be used: '+path);
}
assert.match(fs.readFileSync('calendrier.js','utf8'),/new AbortController\(\)/,'Availability must have cancellation support');
assert.match(fs.readFileSync('calendrier.js','utf8'),/6500/,'Availability must have a finite timeout');
const sitemap=fs.readFileSync('sitemap.xml','utf8');
for(const path of ['/bon-point/','/bon-point/reserver.html','/bon-point/diagnostic.html']){
 assert.ok(sitemap.includes('https://bon-point.github.io'+path),'Missing public discovery path '+path);
}
console.log('OK mailto alternative, zero HTML injection, copying, calendar timeout and public sitemap');
