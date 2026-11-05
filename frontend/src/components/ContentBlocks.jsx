import {backgroundAppearance} from '../utils/pageBackground';
import {useEffect,useState} from 'preact/hooks';
import {WebsiteContent} from './WebsiteContent';
import {PageImageLayout} from './PageImageLayout';
import {SectionAccordions} from './Accordion';
import {Slideshow} from './Slideshow';
import {pageBlocks,imageDefaults,youtubeId,localImage,localAudio,safeBlockLink} from '../utils/contentBlocks';
import '../styles/content-blocks.css';

export function YouTubeBlock({data}) {
  const id=youtubeId(data.video);
  const [active,setActive]=useState(false);
  useEffect(()=>setActive(false),[id]);
  if(!id)return <p className="block-empty">Bitte eine gültige YouTube-Adresse hinterlegen.</p>;
  return <figure className="block-youtube">
    <div className="block-video-frame">
      {active?<iframe key={id} src={'https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0'} title={data.title||'YouTube-Video'} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:
      <div className="block-video-consent">
        {localImage(data.cover)&&<img src={data.cover} alt="" loading="lazy"/>}
        <div><strong>{data.title||'YouTube-Video'}</strong><p>Beim Laden wird eine Verbindung zu YouTube/Google hergestellt. Dabei werden Daten wie Ihre IP-Adresse übertragen und es können Speichertechniken verwendet werden.</p><button type="button" onClick={()=>setActive(true)}>YouTube-Video laden</button><a href={'https://www.youtube.com/watch?v='+id} target="_blank" rel="noopener noreferrer">Auf YouTube öffnen ↗</a></div>
      </div>}
    </div>
    {active&&<button type="button" className="block-video-stop" onClick={()=>setActive(false)}>Video schließen</button>}
    {data.caption&&<figcaption>{data.caption}</figcaption>}
  </figure>;
}

function ImageBlock({data,pageId}) {
  const o={...imageDefaults,...data.options};
  if(data.raw_image&&localImage(data.src)){const doc=new DOMParser().parseFromString(data.raw_image,'text/html');const img=doc.querySelector('img');if(img){img.setAttribute('src',data.src);if(img.hasAttribute('alt')||data.alt)img.setAttribute('alt',data.alt||'');return <WebsiteContent html={img.outerHTML} pageId={pageId}/>;}}
  return <div className={'block-image-layout '+(localImage(data.src)&&o.layout==='beside'?'block-image-beside ':'')+(o.align==='right'?'block-image-right':'')}>
    {localImage(data.src)&&<div className="block-image-column"><figure style={{width:o.width+'%',marginLeft:o.align==='left'?0:'auto',marginRight:o.align==='right'?0:'auto'}}>
      <img src={data.src} alt={data.alt||''} loading="lazy" decoding="async" style={{aspectRatio:o.format==='original'?'auto':o.format.replace(':',' / '),height:'auto',objectFit:o.format==='original'?'contain':'cover',objectPosition:o.focus_x+'% '+o.focus_y+'%'}}/>
      {data.caption&&<figcaption>{data.caption}</figcaption>}
    </figure></div>}
    <div className="block-image-copy"><WebsiteContent html={data.html||''} pageId={pageId}/></div>
  </div>;
}

/** Original layout scaffolds contain only sanitized slots; elements remain independent. */
export function ContentBlocks({page,preview=false}) {
 const blocks=pageBlocks(page.content_blocks).filter(b=>b.enabled);
 const background=backgroundAppearance(page.bg_color,page.bg_image_url);
 const legal=['legalnotice','dsgvo','impressum','datenschutz'].includes(page.id);
 const copyClass='page-copy '+(page.id==='home'?'home-content':legal?'legal-content':'article-content')+(Object.keys(background).length?' has-page-background':'');
 const render=(block,bare=false)=>{
  const d=block.data||{};let content;
  if(block.type==='legacy')return <div key={block.id} className="content-block block-legacy"><PageImageLayout src={!legal?page.image_url:null} alt={page.title||''} mode={page.image_layout}><div className={copyClass} style={background}><WebsiteContent html={page.content||''} pageId={page.id}/><SectionAccordions accordions={page.accordions||[]}/></div></PageImageLayout></div>;
  if(block.type==='text')content=<WebsiteContent html={d.html||''} pageId={page.id}/>;
  if(block.type==='image')content=<ImageBlock data={d} pageId={page.id}/>;
  if(block.type==='slideshow')content=<Slideshow images={(d.images||[]).filter(i=>localImage(i.src))} options={d.options||{'slide-duration':(d.interval||5)*1000,'effect-speed':800,fullscreen:'true'}}/>;
  if(block.type==='accordion')content=<SectionAccordions accordions={(d.items||[]).filter(i=>i.enabled!==false).map(i=>({...i,content:i.html}))}/>;
  if(block.type==='youtube')content=<YouTubeBlock key={youtubeId(d.video)} data={d}/>;
  if(block.type==='audio'&&localAudio(d.src))content=<figure><audio controls preload="none" src={d.src} aria-label={d.title||'Audio'}/><figcaption>{d.caption}</figcaption></figure>;
  if(block.type==='link'&&safeBlockLink(d.href))content=<a className={d.style==='button'?'block-button':'block-link'} href={safeBlockLink(d.href)}>{d.label||d.title||'Link öffnen'} <span aria-hidden="true">↗</span></a>;
  const inside=<>{d.title&&<h2>{d.title}</h2>}{content}</>;
  return bare?inside:<section key={block.id} className={'content-block block-'+block.type} data-block-id={block.id}>{Object.keys(background).length?<div className={copyClass} style={background}>{inside}</div>:inside}</section>;
 };
 const output=[];
 for(let index=0;index<blocks.length;){
  const first=blocks[index],layout=first.data?.layout;
  if(!layout){output.push(render(first));index++;continue;}
  const group=[];while(index<blocks.length&&blocks[index].data?.layout?.group===layout.group)group.push(blocks[index++]);
  const lead=group[0]?.id===layout.lead?group.shift():null;
  const slots={};layout.slots.forEach((id,i)=>{slots[id]=group[i]?render(group[i],true):null;});
  const copy=<div className={copyClass+' unified-layout'} style={background}><WebsiteContent html={layout.html} pageId={page.id} slots={slots}/>{group.slice(layout.slots.length).map(b=>render(b,true))}</div>;
  output.push(<div className="content-block block-legacy" key={layout.group+'-'+first.id}>{lead?<PageImageLayout src={lead.data.src} alt={lead.data.alt||''} mode={layout.mode} options={lead.data.options}>{copy}</PageImageLayout>:copy}</div>);
 }
 return <div className={'content-blocks'+(preview?' is-editor-preview':'')}>{output}</div>;
}
