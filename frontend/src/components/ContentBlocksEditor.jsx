import {CmsIcon,IconButton} from './CmsActions';
import {useRef,useState} from 'preact/hooks';
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
    {(block.type==='text'||block.type==='image')&&<RichTextEditor value={d.html||''} onChange={v=>set('html',v)} label="Text des Bausteins"/>}
    {block.type==='image'&&<>
      {image('src')}
      <label>Alternativtext für das Bild<input value={d.alt||''} maxLength={500} onInput={e=>set('alt',e.target.value)}/></label>
      <label>Bildunterschrift<input value={d.caption||''} maxLength={500} onInput={e=>set('caption',e.target.value)}/></label>
      <SectionImageOptions value={d.options} onChange={v=>set('options',v)}/>
    </>}
    {block.type==='slideshow'&&<>
      <label>Standzeit je Bild (Sekunden)<input type="number" min="3" max="20" value={d.interval||5} onInput={e=>set('interval',Number(e.target.value))}/></label>
      <SlideshowEditor html={writeGallery('',0,d.images||[])} pageId={block.id} csrfToken={csrfToken} onBusyChange={onBusyChange} onChange={html=>set('images',readGalleries(html,block.id)[0]||[])}/>
    </>}
    {block.type==='accordion'&&<>
      {(d.items||[]).map((item,index)=><div key={item.id} className="block-item-editor">
        <label>Thema {index+1}<input maxLength={255} value={item.title} onInput={e=>set('items',d.items.map((v,i)=>i===index?{...v,title:e.target.value}:v))}/></label>
        <RichTextEditor value={item.html} onChange={html=>set('items',d.items.map((v,i)=>i===index?{...v,html}:v))} label={'Text für Thema '+(index+1)}/>
        <div className="block-item-actions"><IconButton icon="up" disabled={!index} onClick={()=>set('items',moveBlock(d.items,index,index-1))} label={'Thema '+(index+1)+' nach oben'}/><IconButton icon="down" disabled={index===d.items.length-1} onClick={()=>set('items',moveBlock(d.items,index,index+1))} label={'Thema '+(index+1)+' nach unten'}/><IconButton icon="trash" danger label={'Thema '+(index+1)+' entfernen'} onClick={()=>set('items',d.items.filter((_,i)=>i!==index))}/></div>
      </div>)}
      <IconButton icon="plus" label="Thema hinzufügen" disabled={(d.items||[]).length>=50} onClick={()=>set('items',[...(d.items||[]),{id:blockId(),title:'Neues Thema',html:''}])}/>
    </>}
    {block.type==='youtube'&&<>
      <label>YouTube-Adresse oder Video-ID<input value={d.video||''} maxLength={500} onInput={e=>set('video',e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label>
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

export function ContentBlocksEditor({blocks,onChange,csrfToken,onBusyChange,busy=false,legacyEditor}) {
  const [type,setType]=useState('text'),[message,setMessage]=useState('');
  const dragging=useRef(null),latest=useRef(blocks);latest.current=blocks;
  const update=(id,patch)=>onChange(latest.current.map(b=>b.id===id?{...b,data:{...b.data,...patch}}:b));
  const move=(from,to)=>{onChange(moveBlock(latest.current,from,to));setMessage('Baustein auf Position '+(to+1)+' verschoben.');};
  const add=()=>{if(latest.current.length>=50)return;onChange([...latest.current,createBlock(type)]);setMessage('Baustein hinzugefügt. Zum Übernehmen die Seite speichern.');};
  return <section className="block-editor" aria-label="Inhaltsbausteine bearbeiten">
    <h3>Inhaltsbausteine</h3>
    <p className="block-editor-hint">Die Seite wird in dieser Reihenfolge aufgebaut. Bausteine am Griff ziehen oder mit den Pfeilen verschieben. Alle Änderungen erscheinen sofort in der Vorschau.</p>
    <p className="cms-icon-legend">Symbole: Maus darüber halten oder mit der Tab-Taste auswählen, um die Erklärung zu sehen.</p><p role="status" className="block-editor-hint">{message}</p>
    {blocks.length===0&&<p className="block-editor-empty">Noch keine sichtbaren Inhaltsbausteine eingerichtet. Unten einen Baustein hinzufügen.</p>}
    <ol className="block-editor-list">
      {blocks.map((block,index)=><li key={block.id} className={'block-editor-card'+(!block.enabled?' is-hidden':'')} data-block-id={block.id}
        onDragOver={e=>{if(dragging.current&&!busy){e.preventDefault();e.dataTransfer.dropEffect='move';}}}
        onDrop={e=>{if(!dragging.current||busy)return;e.preventDefault();e.stopPropagation();const from=latest.current.findIndex(b=>b.id===dragging.current);move(from,index);dragging.current=null;}}>
        <div className="block-editor-bar">
          <IconButton icon="drag" draggable={!busy} disabled={busy} label={'Baustein '+(index+1)+' ziehen zum Sortieren'} onDragStart={e=>{dragging.current=block.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',block.id);}} onDragEnd={()=>{dragging.current=null;}}/>
          <strong>{index+1}. {blockTypes.find(([v])=>v===block.type)?.[1]||block.type}{!block.enabled?' · ausgeblendet':''}</strong>
          <IconButton icon="up" disabled={busy||index===0} label={'Baustein '+(index+1)+' nach oben'} onClick={()=>move(index,index-1)}/>
          <IconButton icon="down" disabled={busy||index===blocks.length-1} label={'Baustein '+(index+1)+' nach unten'} onClick={()=>move(index,index+1)}/>
          <IconButton icon={block.enabled?'eye':'eyeOff'} label={'Baustein '+(index+1)+(block.enabled?' ausblenden':' einblenden')} disabled={busy} aria-pressed={!block.enabled} onClick={()=>onChange(latest.current.map(b=>b.id===block.id?{...b,enabled:!b.enabled}:b))}/>
          <IconButton icon="trash" danger label={'Baustein '+(index+1)+' entfernen'} disabled={busy} onClick={()=>{onChange(latest.current.filter(b=>b.id!==block.id));setMessage('Baustein entfernt. Die Änderung wird erst mit der Seite gespeichert.');}}/>
        </div>
        <details open><summary className="block-editor-summary" aria-label="Baustein bearbeiten" title="Bearbeitung auf- oder zuklappen"><CmsIcon name="edit"/><span className="sr-only">Baustein bearbeiten</span></summary>
          {block.type==='legacy'?<div className="block-editor-fields"><p className="block-editor-hint">Die bisherigen Texte, Bilder und Akkordeons bleiben erhalten. Wird dieser Baustein entfernt, kann er über „Bestehender Seiteninhalt“ wieder hinzugefügt werden.</p>{legacyEditor}</div>:
            <BlockFields block={block} onChange={data=>update(block.id,data)} csrfToken={csrfToken} onBusyChange={onBusyChange} busy={busy}/>}
        </details>
      </li>)}
    </ol>
    <div className="block-editor-add"><label>Bausteintyp<select aria-label="Bausteintyp" value={type} onChange={e=>setType(e.target.value)} disabled={busy}>{blockTypes.map(([value,label])=><option key={value} value={value} disabled={value==='legacy'&&blocks.some(b=>b.type==='legacy')}>{label}</option>)}</select></label><button type="button" disabled={busy||blocks.length>=50||(type==='legacy'&&blocks.some(b=>b.type==='legacy'))} onClick={add}>Inhaltsbaustein hinzufügen</button></div>
  </section>;
}
