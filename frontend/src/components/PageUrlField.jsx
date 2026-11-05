import {proposedPath} from '../utils/pageUrls';
export function PageUrlField({value='',onChange,menuName='',currentPath='',home=false}) {
  const path=home?'/':proposedPath(value,menuName,currentPath);
  return <div className="form-group page-url-field">
    <label>URL-Name (optional)<input type="text" aria-label="URL-Name" value={value} disabled={home} maxLength={200} onInput={e=>onChange(e.target.value)} placeholder="z. B. ueber-mich"/></label>
    <p className="block-editor-hint">Seitenadresse: <strong style={{overflowWrap:'anywhere'}}>{path==='/'&&!home?'Bitte einen Namen eingeben.':path}</strong></p>
    <p className="block-editor-hint">{home?'Die Startseite behält die Adresse /.':'Leer lassen: Beim ersten Speichern entsteht die Adresse aus dem Menünamen (ä → ae, ö → oe, ü → ue, ß → ss). Bestehende Adressen bleiben bei späteren Menüänderungen erhalten. Einen anderen URL-Namen hier ausdrücklich eingeben; alte Links werden weitergeleitet.'}</p>
    {/[\\/?#:\u0000-\u001f]/.test(value)&&<p role="alert">Nur den Namen eingeben, ohne /, Protokoll oder Parameter.</p>}
  </div>;
}
