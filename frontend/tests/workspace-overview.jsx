import {render} from 'preact';
import {useEffect,useState} from 'preact/hooks';
import {I18nProvider,useI18n} from '../src/context/I18nContext';
import {CMSWorkspace} from '../src/components/CMSWorkspace';
import {AdminModal} from '../src/components/AdminModal';
import '../src/styles/style.css';
import '../src/styles/cms-workspace.css';
const pages=[
 {id:'workspace-home-fixture',nav_label:'Home',title:'Architektur & Webdevelopment',subtitle:'Ein synthetischer Beispieltext für die gespeicherte Seitenübersicht.',content:'<p>Testinhalt für die Übersicht.</p>',is_published:1,show_in_navigation:1,menu_parent:'',url_path:'/beispiel'},
 {id:'workspace-draft-fixture',nav_label:'Entwurf',title:'Eine unveröffentlichte Seite',subtitle:'',content:'<p>Entwurf</p>',is_published:0,show_in_navigation:0,menu_parent:''}
];
function Demo(){
 const {setActiveEditSection}=useI18n();const [language,setLanguage]=useState('de');
 useEffect(()=>{const preview='<!doctype html><html lang="de"><body style="margin:0;padding:42px;background:#111316;color:#edf0f2;font-family:Arial,sans-serif"><p style="color:#4ad7d1;font-size:13px">GESPEICHERTER BEISPIELINHALT</p><h1 style="font-size:42px">Architektur &amp; Webdevelopment</h1><p style="line-height:1.8">Synthetische Vorschau für die lokale Prüfung der Seitenübersicht.</p></body></html>';const update=()=>{const frame=document.querySelector('.cms-workspace-preview iframe');if(frame&&frame.srcdoc!==preview)frame.srcdoc=preview;};const observer=new MutationObserver(update);observer.observe(document.getElementById('app'),{childList:true,subtree:true});update();return()=>observer.disconnect();},[]);

 return <><CMSWorkspace sections={pages} language={language} onLanguageChange={setLanguage} onEdit={page=>setActiveEditSection(JSON.parse(JSON.stringify({...page,lang:language})))} onCreate={()=>{}} onDelete={()=>{}} onOpenWebsite={()=>{}} onLogout={()=>{}}/><AdminModal/></>;
}
render(<I18nProvider><Demo/></I18nProvider>,document.getElementById('app'));
