import {render} from 'preact';
import {I18nProvider,useI18n} from '../src/context/I18nContext';
import {AdminModal} from '../src/components/AdminModal';
import {ContentBlocks} from '../src/components/ContentBlocks';
import {backgroundColor} from '../src/utils/pageBackground';
import '../src/styles/style.css';
import '../src/styles/cms-workspace.css';
import '../src/styles/site.css';
const params=new URLSearchParams(window.location.search);
const page={
 id:'background-ui-fixture',title:'Hintergrund-Test',nav_label:'Hintergrund-Test',lang:'de',
 bg_color:backgroundColor(params.get('color')||''),bg_image_url:params.get('image')==='1'?'/tests/block-landscape.png':'',
 content:'<h2>Text auf gewähltem Hintergrund</h2><p>Absatz mit <strong>Fettschrift</strong> und <a href="/contact">Kontaktlink</a>.</p><ul><li>Ein Listeneintrag</li></ul><div class="service-grid"><div class="column"><h3>Eigene dunkle Karte</h3><p>Diese Fläche behält ihren eigenen Textkontrast.</p></div></div>',
 image_url:'',image_layout:'original',is_published:false,show_in_navigation:false,
 accordions:[{id:'acc-background-demo',title:'Aufklappbarer Beispieltext',content:'<p>Auch dieser Text muss lesbar bleiben.</p>'}],
 content_blocks:[{id:'legacy',type:'legacy',enabled:true,data:{}}]
};
function Demo(){
 const {setActiveEditSection}=useI18n();
 return <><main className="public-site" style={{maxWidth:1000,margin:'24px auto',padding:24,color:'#edf0f2'}}> 
 <h1 style={{color:'inherit'}}>Lokaler Hintergrund-Test</h1><p style={{color:'inherit'}}>Synthetische Daten, keine Speicherung in der Inhaltsdatenbank.</p>
 <button type="button" onClick={()=>setActiveEditSection(JSON.parse(JSON.stringify(page)))}>Test-Editor öffnen</button>
 <div style={{marginTop:24}}><ContentBlocks page={page}/></div></main><AdminModal/></>;
}
render(<I18nProvider><Demo/></I18nProvider>,document.getElementById('app'));
