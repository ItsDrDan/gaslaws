#!/usr/bin/env node
/* Deep-link checks: loads index.html?… in Chromium (Playwright) at a phone size (390×844, touch) and a
   desktop size, and checks that each demo link opens its lab, that the plain URL still opens the normal
   start screen, and that nothing logs a console error. Shared scripts from itsdrdan.github.io are served
   from the sibling clones (../games, ../questionbank); track.js is stubbed so tests send no stats.
   Usage: NODE_PATH=/path/to/node_modules node tools/check-deeplink.js   (needs the playwright package) */
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),SIB=path.join(ROOT,'..');
const page0='file://'+path.join(ROOT,'index.html');
const SIZES=[['phone',{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3}],['desktop',{viewport:{width:1280,height:900}}]];
const inView=sel=>`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return r.height>0&&r.top>=-4&&r.top<innerHeight*.6;})()`;
let fails=0,checks=0;const ok=(c,m)=>{checks++;if(!c){fails++;console.log('FAIL',m);}};
async function run(CASES){
 const browser=await chromium.launch();
 for(const [size,opts] of SIZES){
  for(const [query,tests] of CASES){
   const ctx=await browser.newContext({...opts,reducedMotion:'reduce'});const page=await ctx.newPage();const errs=[];
   await ctx.route('https://itsdrdan.github.io/**',r=>{const u=new URL(r.request().url()),p=path.join(SIB,decodeURIComponent(u.pathname));
    if(u.pathname.endsWith('/track.js'))return r.fulfill({status:200,contentType:'text/javascript',body:''});
    if(fs.existsSync(p)&&fs.statSync(p).isFile())return r.fulfill({path:p});return r.abort();});
   await ctx.route(/^https?:\/\/(?!itsdrdan\.github\.io)/,r=>r.abort());
   page.on('console',m=>{if(m.type()==='error'&&!/net::ERR_FAILED|ERR_INTERNET|Failed to load resource/.test(m.text()))errs.push(m.text());});
   page.on('pageerror',e=>errs.push(String(e)));
   await page.goto(page0+query,{waitUntil:'load'});await page.waitForTimeout(400);
   const tag=size+' '+(query||'(plain)');
   for(const [expr,msg] of tests){let v;try{v=await page.evaluate(expr);}catch(e){v='threw '+e.message;}ok(v===true,tag+': '+msg+' ('+JSON.stringify(v)+')');}
   ok(errs.length===0,tag+': console errors: '+errs.join(' | '));
   await ctx.close();
  }
 }
 await browser.close();
 console.log((fails?'FAILED ':'OK ')+checks+' checks, '+fails+' failures');process.exit(fails?1:0);
}
const shown=id=>`(()=>{const e=document.getElementById('${id}');return !!e&&!e.hidden&&e.getClientRects().length>0;})()`;
const labQuest=[[shown('practiceView'),'Practice Quests view is showing'],["S.quest==='lab'",'Piston Lab quest is selected'],
 ["document.querySelector('#featured [data-quest=\"lab\"]').classList.contains('active')",'Piston Lab card is highlighted'],
 [shown('labQ'),'lab question is showing'],[inView('#play'),'quest area is scrolled into view'],["!!S.q&&S.q.kind==='lab'&&S.q.stage==='predict'",'question starts at Predict'],
 ["(()=>{const b=document.querySelector('#labQ [data-lp]');if(!b||!b.getClientRects().length)return false;b.click();return true;})()",'a prediction choice can be tapped'],
 ["S.q.stage==='try'&&byId('labQ').contains(byId('labBody'))&&byId('labBody').getBoundingClientRect().height>100",'after predicting, the piston lab sits inside the question']];
const freePlay=[["byId('labSection').open===true",'Piston Lab (free play) panel is open'],[inView('#labSection'),'panel is scrolled into view'],
 ["byId('labSection').contains(byId('labBody'))&&byId('labBody').getBoundingClientRect().height>100",'lab controls are showing in the panel'],[shown('learnView'),'start screen underneath is unchanged']];
run([
 ['',[[shown('learnView'),'plain URL opens the Learn Trail'],["byId('labSection').open===false",'free-play panel stays closed'],["byId('labQ').hidden===true",'no lab question'],["S.course==='3A'",'default course 3A']]],
 ['?quest=lab',labQuest],
 ['?course=1A&quest=lab',[...labQuest,["S.course==='1A'",'course 1A kept']]],
 ['?open=lab',freePlay],
 ['?course=1A&open=lab',[...freePlay,["S.course==='1A'",'course 1A kept']]],
 ['?quest=nonsense',[[shown('learnView'),'unknown quest falls back to the normal start'],["byId('labSection').open===false",'panel closed']]],
]);
