import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { Slideshow } from './Slideshow';
import metadata from '../slideshows.json';

export function WebsiteContent({html,pageId,slots}) {
  return useMemo(()=>{
    const doc=new DOMParser().parseFromString(sanitizeHtml(html),'text/html');
    let gallery=0;
    function convert(node,key){
      if(node.nodeType===3)return node.textContent;
      if(node.nodeType!==1)return null;
      const slot=[...node.classList].find(name=>name.startsWith('cms-slot-'));
      if(slot&&slots)return slots[slot.slice(9)]??null;
      if(node.classList.contains('MagicSlideshow')||node.classList.contains('local-slideshow')){
        const config=metadata[pageId]?.[gallery++]||{options:{},images:{}};
        const managed=node.classList.contains('cms-gallery');
        const images=[...node.querySelectorAll('img')].map(img=>({src:img.getAttribute('src'),alt:img.getAttribute('alt'),...(managed?{caption:img.getAttribute('alt')||'',title:img.getAttribute('title')||''}:config.images[img.getAttribute('src')])}));
        return <Slideshow key={key} images={images} options={config.options} />;
      }
      const props={key};for(const attr of node.attributes)props[attr.name]=attr.value;
      const children=[...node.childNodes].map((n,i)=>convert(n,i));
      if(slots&&node.querySelector('[class*="cms-slot-"]')&&children.every(child=>child==null||(typeof child==='string'&&!child.trim())))return null;
      return h(node.tagName.toLowerCase(),props,children);
    }
    return [...doc.body.childNodes].map((node,i)=>convert(node,i));
  },[html,pageId,slots]);
}
