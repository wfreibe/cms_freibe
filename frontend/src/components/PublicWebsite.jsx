import {PublicNavigation} from './PublicNavigation';
import {isMenuPage,pageHref} from '../utils/navigation';
import {ContentBlocks} from './ContentBlocks';
import {pageBlocks,localImage} from '../utils/contentBlocks';
import {useState,useEffect} from 'preact/hooks';
import {useI18n} from '../context/I18nContext';
import {sanitizeHtml} from '../utils/sanitizeHtml';
import routes from '../page-routes.json';

export function Brand(){return <span className="brand-word">FREIBERGER<span className="brand-dot">.</span><span className="brand-design">DESIGN</span></span>;}
function Projects({sections}){
 const [filter,setFilter]=useState('all');
 const projects=sections.filter(s=>s.id.startsWith('project-'));
 return <section id="projekte" className="project-section"><div className="section-heading"><div><p className="eyebrow">Einblicke in meine Arbeit</p><h2>Ausgewählte Projekte</h2></div><div className="project-filters" aria-label="Projekte filtern">{[['all','Alle'],['architecture','Architektur'],['web','Webdevelopment']].map(([value,label])=><button type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div></div>
 <div className="project-grid">{projects.filter(p=>filter==='all'||(filter==='web')===['project-wh','project-pc'].includes(p.id)).map(p=>{
  const visible=pageBlocks(p.content_blocks).filter(b=>b.enabled);
  let image='';const pieces=[];
  for(const block of visible){const d=block.data||{};const html=block.type==='legacy'?p.content:d.html||'';const doc=new DOMParser().parseFromString(sanitizeHtml(html),'text/html');if(!image){const candidate=block.type==='legacy'?(p.image_url||doc.querySelector('img')?.getAttribute('src')):block.type==='slideshow'?d.images?.[0]?.src:block.type==='youtube'?d.cover:d.src;if(candidate&&(block.type==='legacy'||localImage(candidate)))image=candidate;}
    if(d.title)pieces.push(d.title);pieces.push(...[...doc.querySelectorAll('h3,p')].map(n=>n.textContent.trim()).filter(Boolean));}
  const web=['project-wh','project-pc'].includes(p.id);const description=pieces.join(' · ');
  const href=pageHref(p.id,routes,p.url_path);
  return <a className="project-card" href={href} key={p.id}><div className="project-image">{image&&<img src={image} alt={p.title} loading="lazy" decoding="async"/>}<span className="project-category">{web?'Webdevelopment':'Architektur'}</span></div><div className="project-caption"><h3>{p.title}</h3><span aria-hidden="true">↗</span></div>{description&&<p>{description}</p>}</a>;
 })}</div>{projects.length===0&&<p>Die Projekte werden geladen.</p>}</section>;
}
export function PublicWebsite(){
 const {sections,apiError}=useI18n();const [menu,setMenu]=useState(false);const [page,setPage]=useState(null);const [error,setError]=useState('');
 const path=window.location.pathname.replace(/\/$/,'')||'/';const preview=/^\/cms\/preview\//.test(path);
 const previewId=path.match(/^\/cms\/preview\/([a-zA-Z0-9_-]+)$/)?.[1];
 const id=page?.id||previewId||routes[path];
 useEffect(()=>{let live=true;setPage(null);setError('');
 (async()=>{
   let target=previewId;
   if(!preview){const response=await fetch('/api/page-route?path='+encodeURIComponent(path)+'&lang=de',{credentials:'omit'});if(!response.ok)throw new Error(response.status===404?'Diese Seite wurde nicht gefunden.':'Inhalte konnten nicht geladen werden.');const route=await response.json();if(!live)return;if(route.redirect){window.location.replace(route.url_path+window.location.search+window.location.hash);return;}target=route.id;}
   if(!target)throw new Error('Diese Seite wurde nicht gefunden.');
   const response=await fetch('/api/sections/'+encodeURIComponent(target)+'?lang=de'+(preview?'&preview=1':''),{credentials:preview?'same-origin':'omit'});
   if(!response.ok)throw new Error(response.status===404?'Diese Seite wurde nicht gefunden.':'Inhalte konnten nicht geladen werden.');const data=await response.json();if(live){setPage(data);document.title='FREIBERGER.DESIGN | '+data.title;}
 })().catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[path,preview,previewId]);
 const home=id==='home';const legal=['dsgvo','legalnotice'].includes(id);
 return <div className="public-site"><a className="skip-link" href="#inhalt">Zum Inhalt</a><header className="site-header"><div className="header-inner"><a href="/" className="site-brand" aria-label="Freiberger Design – Startseite"><Brand/><span className="brand-subtitle">Architektur & Webdevelopment</span></a><button type="button" className="menu-toggle" aria-expanded={menu} aria-controls="public-navigation" onClick={()=>setMenu(v=>!v)}>{menu?'Schließen':'Menü'} <span aria-hidden="true">{menu?'×':'☰'}</span></button><nav id="public-navigation" className={menu?'is-open':''} aria-label="Hauptnavigation"><PublicNavigation sections={sections} currentId={id} onNavigate={()=>setMenu(false)}/>{sections.some(s=>s.id==='contact'&&isMenuPage(s))&&<a className="primary-link" href={pageHref('contact',routes,sections.find(s=>s.id==='contact')?.url_path)} onClick={()=>setMenu(false)}>Projekt besprechen <span aria-hidden="true">↗</span></a>}</nav></div></header>
 <main id="inhalt" className="site-main">{page?<>
 <section className={home?'hero-intro':'page-intro'}><p className="eyebrow">{home?'Dipl.-Ing. Werner Freiberger':legal?'Informationen':id.startsWith('project-')?'Einblicke in meine Arbeit':'Persönlich & direkt'}</p><div className="intro-grid"><h1>{home&&page.title.includes('&')?<>{page.title.split('&')[0]}&<br/><span>{page.title.split('&').slice(1).join('&').trim()}</span></>:page.title==='contact'?'Kontakt':page.title}</h1>{page.subtitle&&<p className="intro-copy">{page.subtitle}</p>}</div>{home&&<div className="hero-bottom"><p>Architektur · Leistungsphasen 1–4</p><a href="#projekte">Projekte entdecken <span aria-hidden="true">↓</span></a></div>}</section>
 <ContentBlocks page={page}/>

 {home&&<><Projects sections={sections}/><section className="contact-callout"><p className="eyebrow">Der erste Schritt ist ein Gespräch</p><h2>Eine Idee für Ihr Haus.<br/>Oder für Ihre Webseite.</h2><div><p>Ich freue mich darauf, Ihr Vorhaben kennenzulernen.</p><a className="primary-link" href="/contact">Kontakt aufnehmen <span aria-hidden="true">↗</span></a></div></section></>}
 {id?.startsWith('project-')&&<a className="back-link" href="/#projekte">← Alle Projekte</a>}
 </>:<section className="page-intro" role="status"><h1>{error|| (apiError?'Inhalte konnten nicht geladen werden.':'Inhalte werden geladen …')}</h1></section>}</main>
 <footer className="site-footer"><div><a className="site-brand" href="/"><Brand/></a><p>Dipl.-Ing. Werner Freiberger<br/>Architektur & Webdevelopment · Maitenbeth</p></div><nav aria-label="Weitere Informationen"><a href="/legalnotice">Impressum</a><a href="/dsgvo">Datenschutz</a><a href="/contact">Kontakt</a><a href="/cms">CMS</a></nav><p className="copyright">© {new Date().getFullYear()} FREIBERGER.DESIGN</p></footer></div>;
}
