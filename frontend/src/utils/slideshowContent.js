

export function readGalleries(html,pageId,metadata={}) {
 const doc=new DOMParser().parseFromString(html||'','text/html');
 return [...doc.querySelectorAll('.MagicSlideshow,.local-slideshow')].map((gallery,index)=>{
  const managed=gallery.classList.contains('cms-gallery');
  return [...gallery.querySelectorAll('img')].map(img=>{
   const legacy=metadata[pageId]?.[index]?.images[img.getAttribute('src')];
   return {src:img.getAttribute('src')||'',caption:managed?(img.getAttribute('alt')||''):(legacy?.caption||img.getAttribute('alt')||''),title:managed?(img.getAttribute('title')||''):(legacy?.title||img.getAttribute('title')||'')};
  });
 });
}
export function writeGallery(html,index,images) {
 const doc=new DOMParser().parseFromString(html||'','text/html');
 let gallery=doc.querySelectorAll('.MagicSlideshow,.local-slideshow')[index];
 if(!gallery){gallery=doc.createElement('div');doc.body.prepend(gallery);}
 gallery.className='MagicSlideshow local-slideshow cms-gallery';
 gallery.replaceChildren(...images.map(image=>{const img=doc.createElement('img');img.setAttribute('src',image.src);img.setAttribute('alt',image.caption||'');img.setAttribute('title',image.title||'');return img;}));
 return doc.body.innerHTML;
}
