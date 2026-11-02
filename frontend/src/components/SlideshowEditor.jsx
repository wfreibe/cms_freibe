import metadata from '../slideshows.json';
import { useMemo,useRef,useState } from 'preact/hooks';
import {readGalleries,writeGallery} from '../utils/slideshowContent';

export function SlideshowEditor({html,pageId,csrfToken,onChange,onBusyChange}) {
 const galleries=useMemo(()=>readGalleries(html,pageId,metadata),[html,pageId]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const dragging=useRef(null);const latest=useRef(html);latest.current=html;
 const update=(g,images)=>onChange(writeGallery(latest.current,g,images));
 const edit=(g,i,patch)=>update(g,galleries[g].map((image,n)=>n===i?{...image,...patch}:image));
 const move=(g,from,to)=>{const images=[...galleries[g]];if(from===to||to<0||to>=images.length)return;images.splice(to,0,images.splice(from,1)[0]);update(g,images);setMessage('Bild auf Position '+(to+1)+' verschoben.');};
 async function upload(files,g,replace){
  if(busy||!files.length)return;
  setBusy(true);onBusyChange(true);setError('');setMessage('Bilder werden hochgeladen …');
  try {
   for(const file of files){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Bitte JPEG, PNG oder WebP bis 8 MB wählen.');
    const body=new FormData();body.append('image',file);
    const res=await fetch('/api/media',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrfToken},body});
    const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Bild konnte nicht hochgeladen werden.');
    const current=readGalleries(latest.current,pageId,metadata)[g]||[];
    const image={src:data.url,caption:'',title:''};
    if(replace!==undefined)current[replace]={...current[replace],src:data.url};else current.push(image);
    const next=writeGallery(latest.current,g,current);latest.current=next;onChange(next);
   }
   setMessage('Upload abgeschlossen. Zum Übernehmen die Seite speichern.');
  }catch(e){setError(e.message);setMessage('');}finally{setBusy(false);onBusyChange(false);}
 }
 return <section className="cms-slideshow-editor" aria-label="Slideshow bearbeiten">
  <h3>Slideshow</h3><p>Bilder am Griff ziehen oder mit den Pfeilen verschieben. Änderungen werden mit der Seite gespeichert.</p>
  {error&&<p role="alert" className="slideshow-error">{error}</p>}<p role="status">{message}</p>
  <fieldset disabled={busy}>
  {galleries.map((images,g)=><div className="slideshow-gallery" key={g}>
   {galleries.length>1&&<h4>Slideshow {g+1}</h4>}
   <ol className="slideshow-image-list">{images.map((image,i)=><li key={image.src+':'+i} onDragOver={e=>{if(dragging.current?.gallery===g){e.preventDefault();e.dataTransfer.dropEffect='move';}}} onDrop={e=>{e.preventDefault();const source=dragging.current;if(source?.gallery===g)move(g,source.index,i);dragging.current=null;}}>
    <button type="button" className="slideshow-drag-handle" draggable={!busy} aria-label={'Bild '+(i+1)+' ziehen'} title="Ziehen zum Sortieren" onDragStart={e=>{dragging.current={gallery:g,index:i};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));}} onDragEnd={()=>{dragging.current=null;}}>⠿</button>
    <img src={image.src} alt={image.caption||'Bild '+(i+1)} className="slideshow-thumbnail" />
    <div className="slideshow-image-fields"><label>Bildunterschrift<input value={image.caption} maxLength={500} onInput={e=>edit(g,i,{caption:e.target.value})}/></label><label>Bildtitel<input value={image.title} maxLength={200} onInput={e=>edit(g,i,{title:e.target.value})}/></label>
     <label className="slideshow-file-label">Bild austauschen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{upload([...e.target.files],g,i);e.target.value='';}} /></label>
    </div>
    <div className="slideshow-image-actions"><button type="button" disabled={i===0} aria-label={'Bild '+(i+1)+' nach oben'} onClick={()=>move(g,i,i-1)}>↑</button><button type="button" disabled={i===images.length-1} aria-label={'Bild '+(i+1)+' nach unten'} onClick={()=>move(g,i,i+1)}>↓</button><button type="button" aria-label={'Bild '+(i+1)+' aus Slideshow entfernen'} onClick={()=>update(g,images.filter((_,n)=>n!==i))}>Entfernen</button></div>
   </li>)}</ol>
   <label className="slideshow-file-label">Bilder hinzufügen<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{upload([...e.target.files],g);e.target.value='';}} /></label>
  </div>)}
  {!galleries.length&&<button type="button" onClick={()=>update(0,[])}>Slideshow anlegen</button>}
  </fieldset><small>JPEG, PNG oder WebP · maximal 8 MB und 12 Megapixel pro Bild. Entfernen aus der Slideshow löscht die Bilddatei nicht.</small>
 </section>;
}
