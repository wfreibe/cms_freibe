import {useEffect,useRef,useState} from 'preact/hooks';
import {prepareRichText,serializeRichText,cleanPastedText,safeEditorLink} from '../utils/richText';

export function RichTextEditor({value,onChange,sourceRef,label='Text bearbeiten'}){
 const editor=useRef(null),galleries=useRef([]),last=useRef(null),selection=useRef(null);
 const [source,setSource]=useState(false),[linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(last.current===value)return;const prepared=prepareRichText(value);galleries.current=prepared.galleries;if(editor.current)editor.current.innerHTML=prepared.html;last.current=value;},[value]);
 const remember=()=>{const sel=window.getSelection();if(sel?.rangeCount&&editor.current?.contains(sel.anchorNode))selection.current=sel.getRangeAt(0).cloneRange();};
 const restore=()=>{editor.current.focus();const sel=window.getSelection();const range=selection.current;if(range&&editor.current.contains(range.commonAncestorContainer)){sel.removeAllRanges();sel.addRange(range);}};
 const emit=()=>{const html=serializeRichText(editor.current.innerHTML,galleries.current);last.current=html;onChange(html);remember();};
 const command=(name,argument)=>{restore();document.execCommand('styleWithCSS',false,false);document.execCommand(name,false,argument);emit();};
 const addLink=()=>{const href=url.trim();if(!safeEditorLink(href)){setMessage('Bitte eine gültige Adresse eingeben: https://…, mailto:…, tel:… oder /seite.');return;}
  restore();const sel=window.getSelection();if(sel?.isCollapsed){const a=document.createElement('a');a.href=href;a.textContent=href;command('insertHTML',a.outerHTML);}else command('createLink',href);
  setLinkOpen(false);setUrl('');setMessage('');
 };
 const button=(name,text,cmd)=><button type="button" aria-label={name} title={name} disabled={source} onMouseDown={e=>e.preventDefault()} onClick={()=>command(cmd)}>{text}</button>;
 return <div className="rich-text-editor">
  <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatieren">
   <label className="rich-format-label"><span className="sr-only">Absatzformat</span><select aria-label="Absatzformat" disabled={source} defaultValue="p" onMouseDown={remember} onChange={e=>command('formatBlock','<'+e.target.value+'>')}><option value="p">Normaler Text</option><option value="h2">Überschrift 2</option><option value="h3">Überschrift 3</option><option value="h4">Überschrift 4</option></select></label>
   {button('Fett','F','bold')}{button('Kursiv','K','italic')}{button('Aufzählung','• Liste','insertUnorderedList')}{button('Nummerierte Liste','1. Liste','insertOrderedList')}
   <button type="button" disabled={source} onMouseDown={e=>e.preventDefault()} onClick={()=>{remember();setLinkOpen(v=>!v);setMessage('');}}>Link</button>
   {button('Link entfernen','Link lösen','unlink')}{button('Formatierung entfernen','Format löschen','removeFormat')}{button('Rückgängig','↶','undo')}{button('Wiederholen','↷','redo')}
   <button type="button" aria-pressed={source} className="rich-source-toggle" onClick={()=>{setSource(v=>!v);setLinkOpen(false);}}>HTML</button>
  </div>
  {linkOpen&&<div className="rich-link-panel"><label>Link-Adresse<input type="text" value={url} placeholder="https://…" onInput={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addLink();}if(e.key==='Escape')setLinkOpen(false);}}/></label><button type="button" onClick={addLink}>Link übernehmen</button><button type="button" onClick={()=>setLinkOpen(false)}>Schließen</button></div>}
  {message&&<p className="rich-message" role="status">{message}</p>}
  <div hidden={source} ref={editor} className="rich-editable" role="textbox" aria-label={label} aria-multiline="true" contentEditable="true" spellcheck="true" onInput={emit} onMouseUp={remember} onKeyUp={remember} onBlur={remember}
   onPaste={e=>{e.preventDefault();remember();command('insertHTML',cleanPastedText(e.clipboardData.getData('text/html'),e.clipboardData.getData('text/plain')));}}
   onDrop={e=>{e.preventDefault();setMessage('Bilder bitte über den Slideshow-Bereich hochladen.');}} />
  {source&&<textarea ref={sourceRef} className="rich-html-source" aria-label={label+' – HTML'} rows={12} value={value} onInput={e=>onChange(e.target.value)} />}
  <p className="rich-editor-hint">Text direkt bearbeiten und formatieren. Einfügen aus Word wird bereinigt. Änderungen erscheinen in der Live-Vorschau und werden erst mit „Speichern“ übernommen.</p>
 </div>;
}
