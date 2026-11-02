import {sanitizeHtml} from './sanitizeHtml.js';
export function prepareRichText(value){
 const doc=new DOMParser().parseFromString(sanitizeHtml(value),'text/html');const galleries=[];
 for(const node of [...doc.querySelectorAll('.MagicSlideshow,.local-slideshow')]){
  const index=galleries.push(node.outerHTML)-1;const placeholder=doc.createElement('div');
  placeholder.setAttribute('contenteditable','false');placeholder.setAttribute('data-rich-gallery',String(index));placeholder.className='rich-gallery-placeholder';
  placeholder.textContent='Slideshow '+(index+1)+' · Bilder oben im Slideshow-Bereich bearbeiten';node.replaceWith(placeholder);
 }
 return {html:doc.body.innerHTML,galleries};
}
export function serializeRichText(value,galleries){
 const doc=new DOMParser().parseFromString(value,'text/html');const restored=new Set();
 for(const placeholder of [...doc.querySelectorAll('[data-rich-gallery]')]){
  const index=Number(placeholder.getAttribute('data-rich-gallery'));
  if(!Number.isInteger(index)||!galleries[index]||restored.has(index)){placeholder.remove();continue;}
  const fragment=new DOMParser().parseFromString(galleries[index],'text/html');placeholder.replaceWith(...fragment.body.childNodes);restored.add(index);
 }
 // Selecting/deleting all text must never silently delete a slideshow.
 for(let i=galleries.length-1;i>=0;i--){if(!restored.has(i)){const fragment=new DOMParser().parseFromString(galleries[i],'text/html');doc.body.prepend(...fragment.body.childNodes);}}
 return sanitizeHtml(doc.body.innerHTML);
}
export function cleanPastedText(html,text){
 if(!html){const doc=document.implementation.createHTMLDocument('');return (text||'').split(/\r?\n/).map(line=>{const p=doc.createElement('p');p.textContent=line;return p.outerHTML;}).join('');}
 const doc=new DOMParser().parseFromString(sanitizeHtml(html),'text/html');
 doc.querySelectorAll('img').forEach(node=>node.remove());
 doc.querySelectorAll('*').forEach(node=>{node.removeAttribute('class');node.removeAttribute('id');});
 return doc.body.innerHTML;
}
export function safeEditorLink(value){return /^(https?:\/\/|mailto:|tel:|#|\/(?![\/\\]))/i.test(value)&&!/[\u0000-\u0020\\]/.test(value);}
