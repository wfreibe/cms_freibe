function textPreview(html='',heading=false) {
 const template=document.createElement('template');template.innerHTML=html;
 template.content.querySelectorAll('script,style').forEach(el=>el.remove());
 template.content.querySelectorAll('br').forEach(el=>el.replaceWith(' '));
 template.content.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,blockquote').forEach(el=>el.append(' '));
 const node=heading?(template.content.querySelector('h1,h2,h3,h4,h5,h6')||template.content):template.content;
 const value=node.textContent.replace(/\s+/g,' ').trim();
 return value.length>90?value.slice(0,90)+'…':value;
}

export function blockSummary(block,legacyPage={}) {
 const d=block.data||{};
 const title=(block.type==='legacy'?legacyPage.title:d.title)||d.label||(block.type==='text'?textPreview(d.html||'',true).slice(0,65):block.type==='image'?(d.alt||'Bild'):block.type==='slideshow'?(d.images?.[0]?.title||d.images?.[0]?.caption||'Slideshow'):block.type==='accordion'?(d.items?.[0]?.title||'Akkordeon'):'')||'Ohne Überschrift';
 let detail='';
 switch(block.type){
  case 'legacy': detail='Bisheriger Text, Bilder und Akkordeons';break;
  case 'slideshow': {const n=(d.images||[]).length;detail=n+' '+(n===1?'Bild':'Bilder');break;}
  case 'accordion': {const n=(d.items||[]).length;detail=n+' '+(n===1?'Thema':'Themen');break;}
  case 'image': detail=d.caption||(d.src?'Bild hinterlegt':'Noch kein Bild');break;
  case 'youtube': detail=d.video?'Video hinterlegt':'Noch kein Video';break;
  case 'audio': detail=d.caption||(d.src?'Audiodatei hinterlegt':'Noch keine Audiodatei');break;
  case 'link': detail=d.href||'Noch kein Linkziel';break;
  default: detail=textPreview(d.html)||'Noch kein Text';
 }
 return {title,detail};
}
