'use strict';
const assert=require('assert/strict');
const {JSDOM}=require('jsdom');
const {buildSync}=require('../frontend/node_modules/esbuild');
const path=require('path');
(async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.com',runScripts:'outside-only'});
 const win=dom.window;let failed=false,legalStatus=404;
 const requests=[];
 win.fetch=async url=>{
  requests.push(url);
  if(url.includes('/legal/'))return {ok:legalStatus===200,status:legalStatus,json:async()=>({id:'impressum',content:'<p>Reviewed synthetic</p>'})};
  if(url.includes('/auth/session'))return {ok:true,status:200,json:async()=>({authenticated:false,csrf_token:'synthetic'})};
  if(url.includes('/auth/login'))return {ok:true,status:200,json:async()=>({success:true,authenticated:true,passwordChangeRequired:true,csrf_token:'synthetic'})};
  if(url.includes('/auth/change-password'))return {ok:true,status:200,json:async()=>({success:true,authenticated:true,passwordChangeRequired:false,csrf_token:'rotated'})};
  if(failed)throw new Error('Synthetic network failure');
  return {ok:true,status:200,json:async()=>[{id:'home',title:'Synthetic'}]};
 };
 const bundle=buildSync({stdin:{contents:`import {h,render} from 'preact';import {I18nProvider,useI18n,UI_TRANSLATIONS} from './src/context/I18nContext.jsx';import {LanguageSwitch} from './src/components/LanguageSwitch.jsx';window.translations=UI_TRANSLATIONS;function Probe(){window.cms=useI18n();return h(LanguageSwitch);}window.mount=()=>render(h(I18nProvider,null,h(Probe)),document.getElementById('root'));window.unmount=()=>render(null,document.getElementById('root'));window.mount();`,resolveDir:path.resolve(__dirname,'../frontend'),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',jsxImportSource:'preact'});
 win.eval(bundle.outputFiles[0].text);
 async function wait(check){for(let i=0;i<50;i++){if(check())return;await new Promise(r=>setTimeout(r,20));}throw new Error('UI state did not settle');}
 try{
  await wait(()=>win.cms?.sections.length===1);failed=true;await win.cms.fetchSections();await wait(()=>win.cms.apiError);assert.equal(win.cms.sections.length,0);
  await win.cms.openLegalModal('impressum');await wait(()=>win.cms.legalModalData!==null);assert(!win.cms.legalModalData.content);assert(!win.cms.legalModalData.retry);assert(win.cms.legalModalData.error.includes('nicht veröffentlicht'));
  legalStatus=500;await win.cms.openLegalModal('impressum');await wait(()=>win.cms.legalModalData?.retry);assert(!win.cms.legalModalData.content);
  failed=false;await win.cms.fetchSections();await wait(()=>win.cms.sections.length===1);assert.equal(win.cms.apiError,false);
  const first=await win.cms.loginApi('admin','synthetic');assert.equal(first.passwordChangeRequired,true);
  await wait(()=>win.cms.passwordChangeRequired);assert.equal(win.cms.isAuthenticated,false);
  const changed=await win.cms.changePasswordApi('SyntheticPermanent123456','SyntheticPermanent123456');assert.equal(changed.success,true);
  await wait(()=>win.cms.isAuthenticated);assert.equal(win.cms.passwordChangeRequired,false);
  assert.deepEqual(Object.keys(win.translations.fr).sort(),Object.keys(win.translations.de).sort());
  assert.deepEqual([...win.document.querySelectorAll('.lang-link-btn')].map(b=>b.textContent),['DE','EN','FR']);
  win.document.querySelector('[aria-label="Français"]').click();
  await wait(()=>win.cms.language==='fr'&&win.document.documentElement.lang==='fr');
  await wait(()=>requests.some(u=>u==='/api/sections?lang=fr'));
  assert.equal(win.localStorage.getItem('sfreibe_lang'),'fr');
  assert.equal(win.cms.t('loading'),'Chargement du contenu…');
  assert.equal(win.document.querySelector('[aria-label="Français"]').getAttribute('aria-pressed'),'true');
  win.cms.setLanguage('es');assert.equal(win.cms.language,'fr');
  win.unmount();win.mount();await wait(()=>win.cms.language==='fr');
  legalStatus=404;await win.cms.openLegalModal('impressum');await wait(()=>win.cms.legalModalData!==null);
  assert.equal(win.cms.legalModalData.error,'Ce texte juridique n’est pas publié.');
  console.log('French UI: DE/EN/FR buttons, complete translations, FR requests, persistence/reload, HTML lang and legal message passed.');
  console.log('Frontend state passed: failed API clears old content, legal 404 differs from server failure, restricted login and password change update UI state.');
 }finally{win.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
