import {imageDefaults} from '../utils/contentBlocks';
export {imageDefaults};
export function SectionImageOptions({value,onChange}) {
  const options={...imageDefaults,...value};
  const change=(key,value)=>onChange({...options,...(key==='layout' && value==='beside' && options.align==='center'?{align:'left'}:{}),[key]:value});
  return <fieldset className="image-options"><legend>Bilddarstellung</legend>
    <label>Format<select aria-label="Format" value={options.format} onChange={e=>change('format',e.target.value)}>
      {['original','16:9','3:2','4:3','1:1','3:4'].map(v=><option key={v} value={v}>{v==='original'?'Originalformat (ohne Beschnitt)':v==='3:4'?'3:4 – Hochformat':v}</option>)}
    </select></label>
    <label>Anordnung<select aria-label="Anordnung" value={options.layout} onChange={e=>change('layout',e.target.value)}><option value="above">Bild über Text</option><option value="beside">Bild neben Text</option></select></label>
    <label>Ausrichtung<select aria-label="Ausrichtung" value={options.align} onChange={e=>change('align',e.target.value)}><option value="left">Links</option><option value="center" disabled={options.layout==='beside'}>Mitte (über Text)</option><option value="right">Rechts</option></select></label>
    <label>Bildbreite: {options.width}%<input aria-label="Bildbreite" type="range" min="25" max="100" step="1" value={options.width} onInput={e=>change('width',Number(e.target.value))}/></label>
    <small>Neben dem Text gilt die Breite innerhalb der Bildspalte. Auf kleinen Bildschirmen steht das Bild über dem Text.</small>
    {['x','y'].map(axis=><label key={axis}>Bildfokus {axis==='x'?'horizontal':'vertikal'}: {options['focus_'+axis]}%<input type="range" min="0" max="100" step="1" disabled={options.format==='original'} value={options['focus_'+axis]} onInput={e=>change('focus_'+axis,Number(e.target.value))}/></label>)}
  </fieldset>;
}
