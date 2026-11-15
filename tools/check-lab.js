#!/usr/bin/env node
/* Piston Lab checks: runs the pure-logic block of index.html in Node and compares every
   generated lab question against an independent ideal-gas calculation written here.
   Usage: node tools/check-lab.js [count per family]   (default 2000) */
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i);if(i<0||j<0)throw new Error('marker missing: '+a);return html.slice(i,j);};
const head=cut('const byId=','/* ---------- 2. data');
const logic=cut('/*LAB-LOGIC-START','/*LAB-LOGIC-END*/');
/* the shared number reader lives in the games repo, cloned next to this one */
const ChemParse=require(path.join(__dirname,'..','..','games','brand','chemparse.v2.js'));
const ctx={console,Math,Number,String,Object,Set,Array,JSON,matchMedia:()=>({matches:false}),document:{},window:{ChemParse}};
vm.createContext(ctx);vm.runInContext(head+'\n'+logic+'\nthis.labSpec=labSpec;this.labModel=labModel;this.fmt=fmt;this.parseValue=parseValue;this.sfRange=sfRange;',ctx);
const N=+process.argv[2]||2000,Rg=0.082058,K=273.15;let fails=0,checks=0;
const fail=(m,sp)=>{fails++;if(fails<=25)console.log('FAIL:',m,sp?JSON.stringify({fam:sp.fam,start:sp.lab.start,task:sp.lab.task}):'');};
const ok=(c,m,sp)=>{checks++;if(!c)fail(m,sp);};
const near=(a,b,t=1e-9)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(b));
const M={He:4.003,N2:28.014,Xe:131.29};
/* independent reference: ideal gas with a locked or free piston */
function ref(s){const Vfree=s.n*Rg*s.T/s.Pext,V=s.free?Math.min(25,Math.max(5,Vfree)):s.V;return {V,P:s.n*Rg*s.T/V,clamped:s.free&&(Vfree<5||Vfree>25)};}
const plain=h=>String(h).replace(/<[^>]+>/g,'');
const ascii=t=>t.replace(' × 10','e').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g,c=>c==='⁻'?'-':String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)));
const sfSeen={};
for(const fam of ['boyle','gay','charles','avog','pn','swap'])for(let i=0;i<N;i++){const sp=ctx.labSpec(fam),L=sp.lab,s=L.start,e=L.end;
 const a=ref(s),b=ref(e);
 ok(!a.clamped&&!b.clamped,'free piston hit a stop (state outside 5–25 L)',sp);
 ok(near(L.before.P,a.P,1e-12)&&near(L.after.P,b.P,1e-12)&&near(L.before.V,a.V,1e-12)&&near(L.after.V,b.V,1e-12),'model P/V disagree with PV = nRT',sp);
 if(s.free)ok(near(L.after.P,s.Pext,1e-9),'free piston: pressure must stay equal to outside',sp);else if(L.task.key!=='V')ok(near(L.after.V,s.V),'locked piston: volume must not change',sp);
 /* kinetic picture: hits × push must be proportional to P (relative to the reference state) */
 ok(near(L.after.hits*L.after.push/(L.before.hits*L.before.push),b.P/a.P,1e-9),'hits × push not proportional to P',sp);
 /* speed must depend only on T and M */
 ok(near(L.after.speed/L.before.speed,Math.sqrt((e.T/M[e.gas])/(s.T/M[s.gas])),1e-9),'speed depends on something other than T and M',sp);
 /* slider targets must be reachable: on the slider step and inside its range */
 const t=L.task;if(t.key==='T')ok(t.target>=100&&t.target<=600&&t.target%10===0,'T target off the slider',sp);
 if(t.key==='V')ok(t.target>=5&&t.target<=25&&Math.abs(t.target*2-Math.round(t.target*2))<1e-9,'V target off the slider',sp);
 if(t.key==='n')ok(t.target>=0.2-1e-9&&t.target<=2+1e-9&&Math.abs(t.target*10-Math.round(t.target*10))<1e-9,'n target off the slider',sp);
 ok(s[t.key]!==t.target,'task does not change anything',sp);
 /* prediction key: the observed ratio of the watched quantity */
 const w=L.watch,r=(w==='P'?b.P/a.P:b.V/a.V);const keys=sp.predict.options.map(o=>o.key);
 ok(new Set(keys).size===keys.length&&keys.length>=3,'prediction choices not distinct or too few',sp);
 ok(new Set(sp.predict.options.map(o=>o.html)).size===keys.length,'two prediction choices read the same',sp);
 if(fam==='swap')ok(sp.predict.answer==='1'&&near(r,1),'swap: pressure must not change',sp);
 else ok(near(+sp.predict.answer,Math.round(r*1000)/1000,1e-9)&&keys.includes(sp.predict.answer),'prediction key is not the observed ratio',sp);
 const right=sp.predict.options.find(o=>o.key===sp.predict.answer).html;
 if(fam!=='swap'){ok(r>1?/Goes up/.test(right):r<1?/Drops/.test(right):/same/.test(right),'prediction wording points the wrong way: '+right,sp);}
 ok(sp.explain.options.some(o=>o.key===sp.explain.answer),'explain key missing',sp);
 ok(sp.explain.options.filter(o=>o.key!==sp.explain.answer).every(o=>sp.explain.why[o.key]),'a wrong explanation has no feedback',sp);
 ok(Array.isArray(sp.hints)&&sp.hints.length>=3,'needs 3 graduated hints',sp);
 /* apply step: recompute from the numbers shown to the student */
 const ap=sp.apply;
 if(ap.kind==='numeric'){const txt=plain(ap.prompt),nums=[...txt.matchAll(/(-?\d+(?:\.\d*)?(?: × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?)\s*(atm|L|K|°C|mol)(?![A-Za-z])/g)].map(m=>{const raw=ascii(m[1]);return {v:ctx.parseValue(raw),u:m[2],raw,sf:ctx.sfRange(raw)[0],dp:(raw.split('.')[1]||'').replace(/e.*$/,'').length};});
  let exp,want;const g=u=>nums.filter(x=>x.u===u);
  for(const x of nums)ok(Number.isFinite(x.v)&&x.sf>=1&&x.sf<=5,'a given is not 1–5 clear sig figs: '+x.raw,sp);
  if(fam==='boyle'){const [p1]=g('atm'),[v1,v3]=g('L');exp=p1.v*v1.v/v3.v;want=Math.min(p1.sf,v1.sf,v3.sf);ok(v1.v===s.V,'V₁ in the prompt is not the lab setting',sp);}
  else if(fam==='gay'){const [p1]=g('atm'),[t1]=g('K'),[c3]=g('°C');exp=p1.v*(c3.v+K)/t1.v;want=Math.min(p1.sf,t1.sf,String(Math.round(Math.abs(c3.v+K))).length+Math.min(c3.dp,2));ok(t1.v===s.T,'T₁ in the prompt is not the lab setting',sp);}
  else if(fam==='charles'){const [v1]=g('L'),[t1]=g('K'),[c3]=g('°C');exp=v1.v*(c3.v+K)/t1.v;want=Math.min(v1.sf,t1.sf,String(Math.round(Math.abs(c3.v+K))).length+Math.min(c3.dp,2));ok(t1.v===s.T,'T₁ in the prompt is not the lab setting',sp);}
  else{const u=fam==='avog'?'L':'atm',[x1]=g(u),[n1,n3]=g('mol');exp=x1.v*n3.v/n1.v;want=Math.min(x1.sf,n1.sf,n3.sf);ok(n1.v===s.n,'n₁ in the prompt is not the lab setting',sp);}
  ok(near(ap.answer,exp,1e-9),'apply answer disagrees with the numbers in its prompt ('+txt+') → '+ap.answer+' vs '+exp,sp);
  ok(Number.isFinite(ap.answer)&&ap.answer>0,'apply answer not positive',sp);
  /* answer sig figs = the fewest in the data (the kelvin sum by the addition rule); the shown answer must carry exactly that many */
  ok(ap.sf===want&&ap.sf>=1&&ap.sf<=5,'answer sig figs '+ap.sf+' but the data allow '+want+' ('+txt+')',sp);sfSeen[ap.sf]=(sfSeen[ap.sf]||0)+1;
  const shown=ascii(ctx.fmt(ap.answer,ap.sf));
  const [lo,hi]=ctx.sfRange(shown);ok(lo===ap.sf&&hi===ap.sf,'displayed answer '+shown+' is not '+ap.sf+' sig figs',sp);
  ok(!/treat lab readings/.test(txt),'old 3-sig-fig wording',sp);
  /* °C → K step: rounded by the addition rule, half up (248.0 + 273.15 = 521.2) */
  for(const st of ap.steps.map(plain)){const m=st.match(/T₂ = (-?[\d.]+) \+ 273\.15 = ([\d.]+) K/);if(m){const d=(m[1].split('.')[1]||'').length,want=(Math.round((+m[1]+K)*10**d+1e-6)/10**d).toFixed(d);ok(m[2]===want,'kelvin step '+m[1]+' + 273.15 = '+m[2]+', should be '+want,sp);}}
  {const st=Math.pow(10,Math.floor(Math.log10(Math.abs(ap.answer)))-ap.sf+1);ok(Math.abs(ctx.parseValue(shown)-ap.answer)<=st/2*1.000001,'displayed answer does not parse back: '+shown,sp);}
  for(const tr of ap.traps||[])ok(Math.abs(tr.v-ap.answer)>Math.abs(ap.answer)*0.02,'a trap value is within 2% of the right answer: '+tr.msg,sp);
  ok(!/e[+-]?\d/.test(txt)&&!/NaN|undefined/.test(txt),'raw machine notation or junk in prompt: '+txt,sp);}
 else{ok(ap.options.some(o=>o.key===ap.answer),'apply choice key missing',sp);ok(new Set(ap.options.map(o=>o.key)).size===ap.options.length,'apply choices not distinct',sp);}
 for(const t of [sp.predict.ask,sp.explain.ask,...sp.predict.options.map(o=>o.html),...sp.explain.options.map(o=>o.html)])ok(!/NaN|undefined|Infinity/.test(t),'junk text: '+t,sp);
}
ok(!html.includes('fmt(sp.apply.answer,3)'),'worked solution prints the lab answer at a fixed 3 sig figs');
console.log('answer sig figs seen:',JSON.stringify(sfSeen));console.log(`${checks} checks on ${N*6} lab questions: ${fails?fails+' FAILED':'all passed'}`);if(fails)process.exit(1);
/* decimal commas: "2,5" must not be read as 25; thousands separators still work */
{const cases={'2,5':NaN,'0,25':NaN,'1,200':1200,'12,500.5':12500.5,'2.5':2.5,'4.10E2':410,'4.10*10^2':410,'-3,1':NaN,'1,000,000':1e6};
 let bad=0;for(const [k,v] of Object.entries(cases)){const got=ctx.parseValue(k);if(!(Number.isNaN(v)?Number.isNaN(got):near(got,v)))bad++,console.log('FAIL parseValue',k,'→',got);}
 console.log('parseValue cases:',bad?bad+' FAILED':'all passed');if(bad)process.exit(1);}
