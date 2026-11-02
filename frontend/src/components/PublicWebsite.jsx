import {PageImageLayout} from './PageImageLayout';
import {useState,useEffect} from 'preact/hooks';
import {useI18n} from '../context/I18nContext';
import {WebsiteContent} from './WebsiteContent';
import {sanitizeHtml} from '../utils/sanitizeHtml';
import routes from '../page-routes.json';

export function Brand(){return <span className="brand-word">FREIBERGER<span className="brand-dot">.</span><span className="brand-design">DESIGN</span></span>;}
function Projects({sections}){
 const [filter,setFilter]=useState('all');
 const projects=sections.filter(s=>s.id.startsWith('project-'));
 return <section id="projekte" className="project-section"><div className="section-heading"><div><p className="eyebrow">Einblicke in meine Arbeit</p><h2>Ausgewählte Projekte</h2></div><div className="project-filters" aria-label="Projekte filtern">{[['all','Alle'],['architecture','Architektur'],['web','Webdevelopment']].map(([value,label])=><button type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div></div>
 <div className="project-grid">{projects.filter(p=>filter==='all'||(filter==='web')===['project-wh','project-pc'].includes(p.id)).map(p=>{
  const doc=new DOMParser().parseFromString(sanitizeHtml(p.content),'text/html');
  const img=doc.querySelector('img');const web=['project-wh','project-pc'].includes(p.id);
  const description=[...doc.querySelectorAll('h3,p')].map(n=>n.textContent.trim()).filter(Boolean).join(' · ');
  const href=Object.entries(routes).find(([,id])=>id===p.id)?.[0]||'/section/'+encodeURIComponent(p.id);
  return <a className="project-card" href={href} key={p.id}><div className="project-image">{img&&<img src={img.getAttribute('src')} alt={p.title} loading="lazy" decoding="async"/>}<span className="project-category">{web?'Webdevelopment':'Architektur'}</span></div><div className="project-caption"><h3>{p.title}</h3><span aria-hidden="true">↗</span></div>{description&&<p>{description}</p>}</a>;
 })}</div>{projects.length===0&&<p>Die Projekte werden geladen.</p>}</section>;
}
export function PublicWebsite(){
 const {sections,apiError}=useI18n();const [menu,setMenu]=useState(false);const [page,setPage]=useState(null);const [error,setError]=useState('');
 const path=window.location.pathname.replace(/\/$/,'')||'/';const preview=/^\/cms\/preview\//.test(path);
 const id=routes[path]||path.match(/^\/(?:section|cms\/preview)\/([a-zA-Z0-9_-]+)$/)?.[1];
 useEffect(()=>{let live=true;if(!id){setError('Diese Seite wurde nicht gefunden.');return;}
 fetch('/api/sections/'+encodeURIComponent(id)+'?lang=de'+(preview?'&preview=1':''),{credentials:preview?'same-origin':'omit'}).then(async res=>{if(!res.ok)throw new Error(res.status===404?'Diese Seite wurde nicht gefunden.':'Inhalte konnten nicht geladen werden.');return res.json();}).then(data=>{if(live){setPage(data);document.title='FREIBERGER.DESIGN | '+data.title;}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[id,preview]);
 const home=id==='home';const legal=['dsgvo','legalnotice'].includes(id);
 return <div className="public-site"><a className="skip-link" href="#inhalt">Zum Inhalt</a><header className="site-header"><div className="header-inner"><a href="/" className="site-brand" aria-label="Freiberger Design – Startseite"><Brand/><span className="brand-subtitle">Architektur & Webdevelopment</span></a><button type="button" className="menu-toggle" aria-expanded={menu} aria-controls="public-navigation" onClick={()=>setMenu(v=>!v)}>{menu?'Schließen':'Menü'} <span aria-hidden="true">{menu?'×':'☰'}</span></button><nav id="public-navigation" className={menu?'is-open':''} aria-label="Hauptnavigation"><a href="/" aria-current={home?'page':undefined}>Home</a><a href="/aboutme" aria-current={id==='aboutme'?'page':undefined}>Über mich</a><a href="/#projekte">Projekte</a><a href="/contact" aria-current={id==='contact'?'page':undefined}>Kontakt</a><a className="primary-link" href="/contact">Projekt besprechen <span aria-hidden="true">↗</span></a></nav></div></header>
 <main id="inhalt" className="site-main">{page?<>
 <section className={home?'hero-intro':'page-intro'}><p className="eyebrow">{home?'Dipl.-Ing. Werner Freiberger':legal?'Informationen':id.startsWith('project-')?'Einblicke in meine Arbeit':'Persönlich & direkt'}</p><div className="intro-grid"><h1>{home&&page.title.includes('&')?<>{page.title.split('&')[0]}&<br/><span>{page.title.split('&').slice(1).join('&').trim()}</span></>:page.title==='contact'?'Kontakt':page.title}</h1>{page.subtitle&&<p className="intro-copy">{page.subtitle}</p>}</div>{home&&<div className="hero-bottom"><p>Architektur · Leistungsphasen 1–4</p><a href="#projekte">Projekte entdecken <span aria-hidden="true">↓</span></a></div>}</section>
 <PageImageLayout src={!legal?page.image_url:null} alt={page.title} mode={page.image_layout}>
 <div className={'page-copy '+(home?'home-content':legal?'legal-content':'article-content')+(page.bg_image_url?' has-page-background':'')} style={page.bg_image_url?{backgroundImage:'linear-gradient(rgba(17,19,22,.86),rgba(17,19,22,.86)),url('+JSON.stringify(page.bg_image_url)+')'}:undefined}><WebsiteContent html={page.content} pageId={page.id}/></div>
 </PageImageLayout>
 {home&&<><Projects sections={sections}/><section className="contact-callout"><p className="eyebrow">Der erste Schritt ist ein Gespräch</p><h2>Eine Idee für Ihr Haus.<br/>Oder für Ihre Webseite.</h2><div><p>Ich freue mich darauf, Ihr Vorhaben kennenzulernen.</p><a className="primary-link" href="/contact">Kontakt aufnehmen <span aria-hidden="true">↗</span></a></div></section></>}
 {id?.startsWith('project-')&&<a className="back-link" href="/#projekte">← Alle Projekte</a>}
 </>:<section className="page-intro" role="status"><h1>{error|| (apiError?'Inhalte konnten nicht geladen werden.':'Inhalte werden geladen …')}</h1></section>}</main>
 <footer className="site-footer"><div><a className="site-brand" href="/"><Brand/></a><p>Dipl.-Ing. Werner Freiberger<br/>Architektur & Webdevelopment · Maitenbeth</p></div><nav aria-label="Weitere Informationen"><a href="/legalnotice">Impressum</a><a href="/dsgvo">Datenschutz</a><a href="/contact">Kontakt</a><a href="/cms">CMS</a></nav><p className="copyright">© {new Date().getFullYear()} FREIBERGER.DESIGN</p></footer></div>;
}
