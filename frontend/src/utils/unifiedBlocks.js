import {pageBlocks,createBlock,imageDefaults} from './contentBlocks';
import {sanitizeHtml} from './sanitizeHtml';
import metadata from '../slideshows.json';
import {readGalleries} from './slideshowContent';

export function unifiedBlocks(page) {
 const result=[];
 for(const source of pageBlocks(page.content_blocks)){
  if(source.type!=='legacy'){result.push(JSON.parse(JSON.stringify(source)));continue;}
  const made=[],doc=new DOMParser().parseFromString(sanitizeHtml(page.content||''),'text/html');
  const group=createBlock('text').id;let galleryIndex=0;
  const make=(type,data)=>{const block=createBlock(type);block.enabled=source.enabled;Object.assign(block.data,data);made.push(block);return block;};
  const slot=block=>{const el=doc.createElement('span');el.className='cms-slot-'+block.id;return el;};
  function process(parent){
   const nodes=[...parent.childNodes];let batch=[];
   const flush=()=>{if(!batch.length)return;
    const box=doc.createElement('div');batch.forEach(n=>box.append(n.cloneNode(true)));
    if(box.textContent.trim()||box.querySelector('img,hr,table')){
     const block=make('text',{html:box.innerHTML});
     parent.insertBefore(slot(block),batch[0]);
    }
    batch.forEach(n=>n.remove());batch=[];
   };
   for(const node of nodes){
    if(node.nodeType!==1){batch.push(node);continue;}
    if(node.matches('.MagicSlideshow,.local-slideshow')){
     flush();const index=galleryIndex++;
     const images=readGalleries(node.outerHTML,page.id,{[page.id]:[metadata[page.id]?.[index]||{images:{}}]})[0]||[];
     if(!images.length){node.remove();continue;}
     const originalOptions=metadata[page.id]?.[index]?.options||{};
     const options={'slide-duration':Number(originalOptions['slide-duration'])||3000,'effect-speed':Number(originalOptions['effect-speed'])||2000,fullscreen:originalOptions.fullscreen==='true'?'true':'false'};
     const block=make('slideshow',{images,interval:Math.max(3,Math.min(20,Number(options['slide-duration']||5000)/1000)),options});
     node.replaceWith(slot(block));
    }else if(node.tagName==='IMG'){
     flush();const block=make('image',{src:node.getAttribute('src')||'',alt:node.getAttribute('alt')||'',raw_image:node.outerHTML,options:{...imageDefaults}});
     node.replaceWith(slot(block));
    }else if(node.querySelector('.MagicSlideshow,.local-slideshow,img')){
     flush();process(node);
    }else batch.push(node);
   }
   flush();
  }
  process(doc.body);
  const slots=made.map(b=>b.id);
  let lead=null;
  if(page.image_url){
   lead=make('image',{src:page.image_url,alt:page.title||'',options:{...imageDefaults,format:page.image_layout==='wide'?'16:9':'original'}});
   made.splice(made.indexOf(lead),1);made.unshift(lead);
  }
  const layout={group,html:doc.body.innerHTML,slots,lead:lead?.id||'',mode:page.image_layout||'original'};
  made.forEach(block=>block.data.layout=layout);
  const items=(page.accordions||[]).map(a=>({id:a.id,title:a.title||'',html:a.content||'',enabled:a.is_published!==0&&a.is_active!==0}));
  if(items.length)make('accordion',{items});
  if(page.contact_info&&Object.values(page.contact_info).some(Boolean)){
   const el=doc.createElement('div');
   for(const text of Object.values(page.contact_info)){if(typeof text==='string'&&text){const p=doc.createElement('p');p.textContent=text;el.append(p);}}
   make('text',{html:el.innerHTML});
  }
  result.push(...made);
 }
 if(result.length>50)throw new Error('Diese Seite enthält mehr als 50 Elemente. Bitte die Inhalte zunächst auf mehrere Seiten verteilen.');
 return result;
}
