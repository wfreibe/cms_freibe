import '../styles/background-colors.css';

const presets=[
 {label:'Anthrazit',value:'#111316'},
 {label:'Graphit',value:'#191d22'},
 {label:'Schiefergrau',value:'#30343a'},
 {label:'Hellgrau',value:'#edf0f2'},
 {label:'Weiß',value:'#ffffff'},
 {label:'Logo-Rot',value:'#c7254e'},
 {label:'Türkis',value:'#4ad7d1'}
];
export function BackgroundColorPicker({value='',onChange}) {
 const selected=value.toLowerCase();
 return <fieldset className="cms-background-colors">
  <legend>Hintergrundfarbe</legend>
  <p>Farben dieses Auftritts. Ohne eigene Farbe gilt die Gestaltung der Webseite. Ein Hintergrundbild liegt über der Farbe.</p>
  <div className="cms-background-presets">
   <button type="button" aria-pressed={!value} onClick={()=>onChange('')} title="Eigene Hintergrundfarbe zurücksetzen">Wie Webseite</button>
   {presets.map(p=><button key={p.value} type="button" aria-pressed={selected===p.value} title={p.label+' ('+p.value+')'} onClick={()=>onChange(p.value)}><span className="cms-background-swatch" style={{background:p.value}} aria-hidden="true"/>{p.label}</button>)}
  </div>
  <div className="cms-background-custom">
   <label>Farbauswahl<input type="color" aria-label="Eigene Hintergrundfarbe auswählen" value={/^#[0-9a-f]{6}$/i.test(value)?value:'#111316'} onInput={e=>onChange(e.target.value)}/></label>
   <label>Eigener HEX-Farbcode<input type="text" aria-label="HEX-Farbcode der Hintergrundfarbe" value={value} onInput={e=>onChange(e.target.value)} placeholder="#111316" spellcheck={false}/></label>
  </div>
 </fieldset>;
}
