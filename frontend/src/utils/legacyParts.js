const selector='.MagicSlideshow,.local-slideshow';
function contentDocument(html){return new DOMParser().parseFromString(html||'','text/html');}
export function legacyPartPresence(form) {
 const doc=contentDocument(form.content);
 const slideshow=!!doc.querySelector(selector);
 doc.querySelectorAll(selector).forEach(el=>el.remove());
 const text=!!(doc.body.textContent.trim()||doc.body.querySelector('img,table,video,audio,iframe,hr'));
 return {image:!!form.image_url,background:!!(form.bg_color||form.bg_image_url),slideshow,text,accordions:!!form.accordions?.length,contact:Object.values(form.contact_info||{}).some(value=>String(value||'').trim())};
}
/** Return only the fields owned by the removed area; media files are never touched. */
export function clearLegacyPart(form,part) {
 switch(part){
  case 'image':return {image_url:''};
  case 'background':return {bg_color:'',bg_image_url:''};
  case 'accordions':return {accordions:[]};
  case 'contact':return {contact_info:{}};
  case 'slideshow':{
   const doc=contentDocument(form.content);doc.querySelectorAll(selector).forEach(el=>el.remove());
   return {content:doc.body.innerHTML};
  }
  case 'text':{
   const doc=contentDocument(form.content);
   const galleries=[...doc.querySelectorAll(selector)].filter(el=>!el.parentElement?.closest(selector));
   return {content:galleries.map(el=>el.outerHTML).join('')};
  }
  default:throw new Error('Unbekannter Inhaltsbereich.');
 }
}
