import '../styles/slideshow.css';
import { useState,useEffect,useRef } from 'preact/hooks';

export function Slideshow({images,options={}}){
 const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
 const root=useRef(null);const count=images.length;
 const activeIndex=Math.min(index,Math.max(0,count-1));
 const imageOrder=images.map(image=>image.src).join('|');
 useEffect(()=>setIndex(0),[imageOrder]);
 const duration=Number(options['slide-duration'])||3000;
 const speed=Number(options['effect-speed'])||2000;
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{if(paused||reduced||count<2)return;const timer=setInterval(()=>setIndex(i=>(i+1)%count),duration+speed);return()=>clearInterval(timer);},[paused,reduced,count,duration,speed]);
 const move=delta=>setIndex(i=>(i+delta+count)%count);
 const full=async()=>{try{if(document.fullscreenElement===root.current)await document.exitFullscreen();else await root.current.requestFullscreen();}catch{/* The slideshow remains usable if fullscreen is unavailable. */}};
 if(!count)return null;
 return <section ref={root} className={'design-slideshow'+(options.fullscreen==='true'?' is-project':'')} aria-roledescription="Karussell" aria-label={images[0].title||'Bildergalerie'} style={{'--slide-speed':(reduced?0:speed)+'ms','--slide-cycle':duration+speed+'ms'}} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}}}>
  <div className="design-slides">{images.map((image,i)=><div key={image.src+':'+i} className={'design-slide'+(i===activeIndex?' is-current':'')} aria-hidden={i!==activeIndex}><img src={image.src} loading="eager" decoding="async" fetchpriority={i===0?"high":"auto"} alt={image.caption||image.alt||image.title||''} title={image.title} /></div>)}</div>
  <div className="design-slide-caption" aria-live={paused||reduced?'polite':'off'}><strong>{images[activeIndex].title}</strong><span>{images[activeIndex].caption}</span></div>
  {count>1&&<><button type="button" className="design-slide-arrow is-prev" aria-label="Vorheriges Bild" onClick={()=>move(-1)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5L8 12L15 19" /></svg></button><button type="button" className="design-slide-arrow is-next" aria-label="Nächstes Bild" onClick={()=>move(1)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5L16 12L9 19" /></svg></button></>}
  <div className="design-slide-controls"><span aria-label="Bildnummer">{activeIndex+1} / {count}</span>{count>1&&!reduced&&<button type="button" aria-label={paused?'Slideshow fortsetzen':'Slideshow pausieren'} onClick={()=>setPaused(p=>!p)}>{paused?'▶':'Ⅱ'}</button>}{options.fullscreen==='true'&&<button type="button" aria-label="Vollbild umschalten" onClick={full}>⛶</button>}</div>
 </section>;
}
