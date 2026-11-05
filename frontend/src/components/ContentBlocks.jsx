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
  return <div className={'block-image-layout '+(localImage(data.src)&&o.layout==='beside'?'block-image-beside ':'')+(o.align==='right'?'block-image-right':'')}>
    {localImage(data.src)&&<div className="block-image-column"><figure style={{width:o.width+'%',marginLeft:o.align==='left'?0:'auto',marginRight:o.align==='right'?0:'auto'}}>
      <img src={data.src} alt={data.alt||''} loading="lazy" decoding="async" style={{aspectRatio:o.format==='original'?'auto':o.format.replace(':',' / '),height:'auto',objectFit:o.format==='original'?'contain':'cover',objectPosition:o.focus_x+'% '+o.focus_y+'%'}}/>
      {data.caption&&<figcaption>{data.caption}</figcaption>}
    </figure></div>}
    <div className="block-image-copy"><WebsiteContent html={data.html||''} pageId={pageId}/></div>
  </div>;
}

/** Also used by the unsaved editor preview, with identical order and visibility. */
export function ContentBlocks({page,preview=false}) {
  const blocks=pageBlocks(page.content_blocks);
  const background=backgroundAppearance(page.bg_color,page.bg_image_url);
  const legal=['legalnotice','dsgvo','impressum','datenschutz'].includes(page.id);
  return <div className={'content-blocks'+(preview?' is-editor-preview':'')}>
    {blocks.filter(b=>b.enabled).map(block=>{
      const d=block.data||{};
      if(block.type==='legacy')return <div key={block.id} className="content-block block-legacy" data-block-id={block.id}>
        <PageImageLayout src={!legal?page.image_url:null} alt={page.title||''} mode={page.image_layout}>
          <div className={'page-copy '+(page.id==='home'?'home-content':legal?'legal-content':'article-content')+(Object.keys(background).length?' has-page-background':'')} style={background}>
            <WebsiteContent html={page.content||''} pageId={page.id}/>
            {(page.accordions||[]).length>0&&<SectionAccordions accordions={page.accordions}/>}
          </div>
        </PageImageLayout>
      </div>;
      return <section key={block.id} className={'content-block block-'+block.type} data-block-id={block.id}>
        {d.title&&<h2>{d.title}</h2>}
        {block.type==='text'&&<WebsiteContent html={d.html||''} pageId={page.id}/>}
        {block.type==='image'&&<ImageBlock data={d} pageId={page.id}/>}
        {block.type==='slideshow'&&<Slideshow images={(d.images||[]).filter(i=>localImage(i.src))} options={{'slide-duration':(d.interval||5)*1000,'effect-speed':800,fullscreen:'true'}}/>}
        {block.type==='accordion'&&<div className="block-accordion">{(d.items||[]).map(item=><details key={item.id}><summary>{item.title||'Thema'}</summary><WebsiteContent html={item.html||''} pageId={page.id}/></details>)}</div>}
        {block.type==='youtube'&&<YouTubeBlock key={youtubeId(d.video)} data={d}/>}
        {block.type==='audio'&&localAudio(d.src)&&<figure><audio key={d.src} controls preload="none" src={d.src} aria-label={d.title||'Audio'} /><figcaption>{d.caption}</figcaption></figure>}
        {block.type==='link'&&safeBlockLink(d.href)&&<a className={d.style==='button'?'block-button':'block-link'} href={safeBlockLink(d.href)}>{d.label||d.title||'Link öffnen'} <span aria-hidden="true">↗</span></a>}
      </section>;
    })}
  </div>;
}
