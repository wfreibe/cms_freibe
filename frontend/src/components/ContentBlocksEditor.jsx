import {blockSummary} from '../utils/blockSummary';
import {IconButton} from './CmsActions';
import {useEffect,useRef,useState} from 'preact/hooks';
import {RichTextEditor} from './RichTextEditor';
import {SectionImageUpload} from './SectionImageUpload';
import {SectionImageOptions} from './SectionImageOptions';
import {SlideshowEditor} from './SlideshowEditor';
import {readGalleries,writeGallery} from '../utils/slideshowContent';
import {blockTypes,createBlock,blockId,moveBlock,youtubeId} from '../utils/contentBlocks';
import '../styles/content-blocks.css';

function BlockFields({block,onChange,csrfToken,onBusyChange,busy}) {
  const d=block.data;
  const set=(key,value)=>onChange({[key]:value});
  const image=(key)=> <SectionImageUpload localOnly fieldLabel={key==='cover'?'Vorschaubild für das Video':'Bild dieses Bausteins'} value={d[key]||''} onChange={v=>set(key,v)} csrfToken={csrfToken} onBusyChange={onBusyChange} disabled={busy}/>;
  return <div className="block-editor-fields">
    <label>Baustein-Überschrift (optional)<input value={d.title||''} maxLength={255} onInput={e=>set('title',e.target.value)}/></label>
    {(block.type==='text'||(block.type==='image'&&!d.raw_image))&&<RichTextEditor value={d.html||''} onChange={v=>set('html',v)} label="Text des Bausteins"/>}
    {block.type==='image'&&<>
      {image('src')}
      <label>Alternativtext für das Bild<input value={d.alt||''} maxLength={500} onInput={e=>set('alt',e.target.value)}/></label>
      <label>Bildunterschrift<input value={d.caption||''} maxLength={500} onInput={e=>set('caption',e.target.value)}/></label>
      <SectionImageOptions value={d.options} onChange={v=>onChange({options:v,raw_image:'',...(d.layout?.lead===block.id?{layout:{...d.layout,mode:v.layout==='beside'?(v.align==='right'?'right':'left'):v.format==='original'?'original':'wide'}}:{})})}/>
    </>}
    {block.type==='slideshow'&&<>
      <label>Standzeit je Bild (Sekunden)<input type="number" min="3" max="20" value={d.interval||5} onInput={e=>onChange({interval:Number(e.target.value),...(d.options?{options:{...d.options,'slide-duration':Number(e.target.value)*1000}}:{})})}/></label>
      <SlideshowEditor html={writeGallery('',0,d.images||[])} pageId={block.id} csrfToken={csrfToken} onBusyChange={onBusyChange} onChange={html=>set('images',readGalleries(html,block.id)[0]||[])}/>
    </>}
    {block.type==='accordion'&&<>
      {(d.items||[]).map((item,index)=><div key={item.id} className="block-item-editor">
        <label><input type="checkbox" checked={item.enabled!==false} onChange={e=>set('items',d.items.map((v,i)=>i===index?{...v,enabled:e.target.checked}:v))}/> Thema anzeigen</label><label>Thema {index+1}<input maxLength={255} value={item.title} onInput={e=>set('items',d.items.map((v,i)=>i===index?{...v,title:e.target.value}:v))}/></label>
        <RichTextEditor value={item.html} onChange={html=>set('items',d.items.map((v,i)=>i===index?{...v,html}:v))} label={'Text für Thema '+(index+1)}/>
        <div className="block-item-actions"><IconButton icon="up" disabled={!index} onClick={()=>set('items',moveBlock(d.items,index,index-1))} label={'Thema '+(index+1)+' nach oben'}/><IconButton icon="down" disabled={index===d.items.length-1} onClick={()=>set('items',moveBlock(d.items,index,index+1))} label={'Thema '+(index+1)+' nach unten'}/><IconButton icon="trash" danger label={'Thema '+(index+1)+' entfernen'} onClick={()=>set('items',d.items.filter((_,i)=>i!==index))}/></div>
      </div>)}
      <IconButton icon="plus" label="Thema hinzufügen" disabled={(d.items||[]).length>=50} onClick={()=>set('items',[...(d.items||[]),{id:blockId(),title:'Neues Thema',html:''}])}/>
    </>}
    {block.type==='youtube'&&<>
      <label>YouTube-Adresse oder Video-ID<input value={d.video||''} maxLength={500} ref={el=>el?.setCustomValidity(d.video&&!youtubeId(d.video)?'Bitte eine gültige YouTube-Adresse oder Video-ID eingeben.':'')} onInput={e=>set('video',e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
      {d.video&&!youtubeId(d.video)&&<p role="alert">Die YouTube-Adresse ist noch nicht gültig.</p>}
      <p className="block-editor-hint">Das Video wird erst geladen, wenn Besucher „YouTube-Video laden“ wählen. Ein eigenes Vorschaubild ist optional.</p>
      {image('cover')}
      <label>Bildunterschrift / Beschreibung<input value={d.caption||''} maxLength={500} onInput={e=>set('caption',e.target.value)}/></label>
    </>}
    {block.type==='audio'&&<>
      <label>Pfad zur Audiodatei<input value={d.src||''} maxLength={500} onInput={e=>set('src',e.target.value)} placeholder="/files/mein-audio.mp3"/></label>
      <p className="block-editor-hint">MP3, OGG, WAV oder M4A auf diesem Webspace. Die Audiodatei vorher auf dem Webspace ablegen.</p>
      <label>Beschreibung<input value={d.caption||''} maxLength={500} onInput={e=>set('caption',e.target.value)}/></label>
    </>}
    {block.type==='link'&&<>
      <label>Beschriftung<input value={d.label||''} maxLength={150} onInput={e=>set('label',e.target.value)}/></label>
      <label>Zieladresse<input value={d.href||''} maxLength={500} onInput={e=>set('href',e.target.value)} placeholder="/contact oder https://…"/></label>
      <label>Darstellung<select value={d.style||'button'} onChange={e=>set('style',e.target.value)}><option value="button">Schaltfläche</option><option value="link">Textlink</option></select></label>
    </>}
  </div>;
}

export function ContentBlocksEditor({blocks,onChange,csrfToken,onBusyChange,busy=false}) {
 const [type,setType]=useState('text'),[message,setMessage]=useState(''),[pendingRemove,setPendingRemove]=useState(null);
 const [openIds,setOpenIds]=useState(()=>new Set());
 const editor=useRef(null),focusingInvalid=useRef(false),reportingInvalid=useRef(null);
 const dragging=useRef(null),latest=useRef(blocks);latest.current=blocks;
 const toggle=id=>setOpenIds(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next;});
 const revealError=event=>{
  if(reportingInvalid.current===event.target)return;
  const card=event.target.closest('[data-block-id]');if(!card)return;
  event.preventDefault();setOpenIds(prev=>prev.has(card.dataset.blockId)?prev:new Set([...prev,card.dataset.blockId]));
  if(!focusingInvalid.current){focusingInvalid.current=true;const target=event.target;requestAnimationFrame(()=>{try{if(target.isConnected){target.focus();reportingInvalid.current=target;target.reportValidity();}}finally{reportingInvalid.current=null;focusingInvalid.current=false;}});}
 };
 useEffect(()=>{
  const node=editor.current;if(!node)return;
  const reveal=()=>{const ids=[...node.querySelectorAll('[role="alert"]')].filter(el=>el.textContent.trim()).map(el=>el.closest('[data-block-id]')?.dataset.blockId).filter(Boolean);if(ids.length)setOpenIds(prev=>ids.every(id=>prev.has(id))?prev:new Set([...prev,...ids]));};
  const observer=new MutationObserver(reveal);observer.observe(node,{childList:true,subtree:true,characterData:true});reveal();return()=>observer.disconnect();
 },[]);
 const update=(id,patch)=>onChange(latest.current.map(b=>b.id===id?{...b,data:{...b.data,...patch}}:b));
 const move=(from,to)=>{onChange(moveBlock(latest.current,from,to));setMessage('Element auf Position '+(to+1)+' verschoben.');};
 const add=()=>{if(latest.current.length>=50)return;const block=createBlock(type);setOpenIds(prev=>new Set([...prev,block.id]));onChange([...latest.current,block]);setMessage('Element hinzugefügt. Zum Übernehmen die Seite speichern.');};
 return <section ref={editor} className="block-editor" aria-label="Inhaltselemente bearbeiten" onInvalidCapture={revealError}>
  <div className="block-editor-heading"><h3>Inhaltselemente</h3><div className="block-editor-disclosures" role="group" aria-label="Elemente auf- und zuklappen">
   <button type="button" disabled={busy||!blocks.length} onClick={()=>setOpenIds(new Set(blocks.map(b=>b.id)))}>Alle aufklappen</button>
   <button type="button" disabled={busy||!blocks.length} onClick={()=>setOpenIds(new Set())}>Alle zuklappen</button>
  </div></div>
  <p className="block-editor-hint">Die Seite wird in dieser Reihenfolge aufgebaut. Elemente am Griff ziehen oder mit den Pfeilen verschieben.</p>
  <p role="status" className="block-editor-hint">{message}</p>
  {!blocks.length&&<p>Noch keine Inhaltselemente vorhanden. Unten ein Element hinzufügen.</p>}
  <ol className="block-editor-list">{blocks.map((block,index)=>{const summary=blockSummary(block),open=openIds.has(block.id);return <li key={block.id} className={'block-editor-card'+(!block.enabled?' is-hidden':'')} data-block-id={block.id}
   onDragOver={e=>{if(dragging.current&&!busy){e.preventDefault();e.dataTransfer.dropEffect='move';}}}
   onDrop={e=>{if(!dragging.current||busy)return;e.preventDefault();e.stopPropagation();move(latest.current.findIndex(b=>b.id===dragging.current),index);dragging.current=null;}}>
   <div className="block-editor-bar">
    <IconButton icon="drag" draggable={!busy} disabled={busy} label={'Element '+(index+1)+' ziehen zum Sortieren'} onDragStart={e=>{dragging.current=block.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',block.id);}} onDragEnd={()=>{dragging.current=null;}}/>
    <button type="button" className="block-editor-toggle" disabled={busy} aria-expanded={open} aria-controls={'block-fields-'+block.id} onClick={()=>toggle(block.id)}><span aria-hidden="true">{open?'▾':'▸'}</span><span className="block-editor-overview"><strong>{index+1}. {block.type==='image'&&!block.data.html?'Bild':blockTypes.find(([v])=>v===block.type)?.[1]||block.type}{!block.enabled?' · ausgeblendet':''}</strong><span className="block-editor-title">{summary.title}</span><span className="block-editor-description">{summary.detail}</span></span></button>
    <IconButton icon="up" disabled={busy||!index} label={'Element '+(index+1)+' nach oben'} onClick={()=>move(index,index-1)}/>
    <IconButton icon="down" disabled={busy||index===blocks.length-1} label={'Element '+(index+1)+' nach unten'} onClick={()=>move(index,index+1)}/>
    <IconButton icon={block.enabled?'eye':'eyeOff'} disabled={busy} aria-pressed={!block.enabled} label={'Element '+(index+1)+(block.enabled?' ausblenden':' einblenden')} onClick={()=>onChange(latest.current.map(b=>b.id===block.id?{...b,enabled:!b.enabled}:b))}/>
    <IconButton icon="trash" danger disabled={busy} label={'Element '+(index+1)+' entfernen'} onClick={()=>setPendingRemove(block.id)}/>
   </div>
   {pendingRemove===block.id&&<div className="legacy-panel-removal" role="group" aria-label="Element entfernen bestätigen"><p>Dieses Element entfernen? Andere Elemente und hochgeladene Dateien bleiben erhalten. Wirksam erst mit „Speichern“.</p><button type="button" disabled={busy} onClick={()=>{onChange(latest.current.filter(b=>b.id!==block.id));setPendingRemove(null);setMessage('Element entfernt. Zum Übernehmen die Seite speichern.');}}>Entfernen</button><button type="button" onClick={()=>setPendingRemove(null)}>Abbrechen</button></div>}
   <div id={'block-fields-'+block.id} hidden={!open}><BlockFields block={block} onChange={patch=>update(block.id,patch)} csrfToken={csrfToken} onBusyChange={onBusyChange} busy={busy}/></div>
  </li>;})}</ol>
  <div className="block-editor-add"><label>Elementtyp<select aria-label="Elementtyp" value={type} disabled={busy} onChange={e=>setType(e.target.value)}>{blockTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" disabled={busy||blocks.length>=50} onClick={add}>Element hinzufügen</button></div>
 </section>;
}
