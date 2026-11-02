import {useState,useRef,useEffect} from 'preact/hooks';

export function SectionImageUpload({value,onChange,csrfToken,onBusyChange,disabled=false,kind='section',layout='original',onLayoutChange}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[broken,setBroken]=useState(false);
 const background=kind==='background';
 const name=background?'Hintergrundbild':'Bild';
 const input=useRef(null),controller=useRef(null),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
 useEffect(()=>setBroken(false),[value]);
 async function upload(file){
  if(!file||busy||disabled)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){setError('Bitte JPEG, PNG oder WebP bis 8 MB wählen.');return;}
  setBusy(true);onBusyChange(true);setError('');setMessage('Bild wird hochgeladen …');controller.current=new AbortController();
  try{
   const body=new FormData();body.append('image',file);
   const response=await fetch('/api/media',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrfToken},body,signal:controller.current.signal});
   const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Das Bild konnte nicht hochgeladen werden.');
   if(alive.current){onChange(result.url);setMessage('Bild hochgeladen. Zum Übernehmen die Seite speichern.');}
  }catch(e){if(alive.current&&e.name!=='AbortError'){setError(e.message);setMessage('');}}
  finally{onBusyChange(false);if(alive.current)setBusy(false);controller.current=null;}
 }
 return <div className="section-image-upload">
  <label><strong>{background?'Hintergrundbild (optional)':'Seitenbild'}</strong><input type="text" aria-label={background?'Bild-URL des Hintergrundbildes':'Bild-URL des Seitenbildes'} value={value} disabled={busy||disabled} onInput={e=>onChange(e.target.value)} placeholder="Bild hochladen oder Bild-URL eingeben"/></label>
  {!background&&onLayoutChange&&<div className="section-image-layout-settings"><label>Darstellung<select aria-label="Darstellung des Seitenbildes" value={layout==='left'||layout==='right'?'beside':layout} onChange={e=>onLayoutChange(e.target.value==='beside'?'left':e.target.value)}><option value="original">Originalformat (ohne Beschnitt)</option><option value="wide">16:9 (zugeschnitten)</option><option value="beside">Bild neben Text</option></select></label>{(layout==='left'||layout==='right')&&<label>Bildposition<select aria-label="Bildposition" value={layout} onChange={e=>onLayoutChange(e.target.value)}><option value="left">Links vom Text</option><option value="right">Rechts vom Text</option></select></label>}</div>}
  <div className="section-image-actions"><button type="button" className="cms-workspace-button cms-workspace-button-primary" disabled={busy||disabled} onClick={()=>input.current.click()}>{busy?'Wird hochgeladen …':value?name+' austauschen':name+' hochladen'}</button>{value&&<button type="button" className="cms-workspace-button" disabled={busy||disabled} onClick={()=>{onChange('');setError('');setMessage('Bild entfernt. Zum Übernehmen die Seite speichern.');}}>{name} entfernen</button>}</div>
  <input ref={input} type="file" className="section-image-file" aria-label={background?'Datei für Hintergrundbild auswählen':'Datei für Seitenbild auswählen'} accept="image/jpeg,image/png,image/webp" disabled={busy||disabled} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/>
  <p className="section-image-help">JPEG, PNG oder WebP · maximal 8 MB und 12 Megapixel. {background?'Das Bild erscheint hinter dem Seiteninhalt mit einem dunklen Filter für die Lesbarkeit.':'Die gewählte Darstellung wird mit der Seite gespeichert. Auf schmalen Bildschirmen stehen Bild und Text untereinander.'}</p>
  {error&&<p role="alert" className="slideshow-error">{error}</p>}{message&&<p role="status" className="section-image-help">{message}</p>}
  {value&&<div className={'section-image-preview'+(background?' background-image-preview':layout==='wide'?' section-image-wide':' section-image-original')}>{broken?<p>Das Bild konnte nicht geladen werden. Bitte die Adresse prüfen oder ein neues Bild hochladen.</p>:<img key={value} src={value} alt={background?'Vorschau des Hintergrundbildes':'Vorschau des Seitenbildes'} onError={()=>setBroken(true)}/>}</div>}
 </div>;
}
