import {render} from 'preact';
import {I18nProvider,useI18n} from '../src/context/I18nContext';
import {AdminModal} from '../src/components/AdminModal';
import {ContentBlocks} from '../src/components/ContentBlocks';
import '../src/styles/style.css';
import '../src/styles/cms-workspace.css';
const page={
 id:'blocks-ui-fixture',title:'Baustein-Testseite',nav_label:'Testseite',lang:'de',
 content:'<p>Bestehender Beispieltext bleibt erhalten.</p>',image_url:'',image_layout:'original',
 bg_color:'',bg_image_url:'',is_published:false,show_in_navigation:false,accordions:[],
 content_blocks:[
  {id:'legacy',type:'legacy',enabled:true,data:{}},
  {id:'intro',type:'text',enabled:true,data:{title:'Einleitung',html:'<p>Text vor dem Speichern.</p>'}},
  {id:'film',type:'youtube',enabled:true,data:{title:'Beispielfilm',video:'abcdefghijk',cover:'',caption:'Erst nach Freigabe laden.'}},
  {id:'image',type:'image',enabled:true,data:{title:'Bild und Text',src:'/tests/block-landscape.png',alt:'Synthetisches Farbmuster',caption:'Testbild',html:'<p>Text neben dem Bild.</p>',options:{format:'1:1',layout:'beside',align:'right',width:100,focus_x:50,focus_y:50}}},
  {id:'gallery',type:'slideshow',enabled:true,data:{title:'Beispielgalerie',interval:5,images:[{src:'/tests/block-landscape.png',title:'Breit',caption:'Erstes Bild'},{src:'/tests/block-portrait.png',title:'Hoch',caption:'Zweites Bild'}]}},
  {id:'topics',type:'accordion',enabled:true,data:{title:'Fragen',items:[{id:'one',title:'Wie funktioniert das?',html:'<p>Der Text klappt auf.</p>'}]}}
 ]
};
function Demo(){
 const {setActiveEditSection}=useI18n();
 return <><div style={{padding:24}}><h1>Lokaler Baustein-Test</h1><p>Synthetische Beispieldaten. Änderungen in diesem Test werden nicht in der Datenbank gespeichert.</p><button type="button" onClick={()=>setActiveEditSection(JSON.parse(JSON.stringify(page)))}>Test-Editor öffnen</button><div style={{maxWidth:900,margin:'24px auto'}}><ContentBlocks page={page}/></div></div><AdminModal/></>;
}
render(<I18nProvider><Demo/></I18nProvider>,document.getElementById('app'));
