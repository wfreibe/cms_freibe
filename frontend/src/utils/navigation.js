
const enabled=value=>value===true||value===1;
export function isMenuPage(page) {
  return enabled(page.is_published ?? page.is_active) &&
    (page.show_in_navigation === undefined || enabled(page.show_in_navigation));
}
export function pageHref(id,routes={},urlPath) {
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))return '';
  if(typeof urlPath==='string'&&/^\/(?:[a-z0-9-]+|project\/[A-Za-z0-9_-]+|section\/[A-Za-z0-9_-]+)?$/.test(urlPath))return urlPath;
  return Object.entries(routes).find(([,value])=>value===id)?.[0]||'/section/'+encodeURIComponent(id);
}
export function menuParent(page) {
  return typeof page.menu_parent==='string'?page.menu_parent:(page.id?.startsWith('project-')?'@projects':'');
}
export function buildNavigation(pages,routes={}) {
  const order=page=>Number.isFinite(Number(page.sort_order))?Number(page.sort_order):Number.MAX_SAFE_INTEGER;
  const visible=pages.filter(isMenuPage).map((page,index)=>({page,index})).sort((a,b)=>order(a.page)-order(b.page)||a.index-b.index).map(({page})=>page);
  const item=page=>({id:page.id,label:page.nav_label||page.title||page.id,href:pageHref(page.id,routes,page.url_path)});
  const roots=new Map(visible.filter(p=>menuParent(p)==='').map(p=>[p.id,item(p)]));
  const projectPages=visible.filter(p=>menuParent(p)==='@projects');
  for(const page of visible){const parent=menuParent(page);if(parent&&parent!=='@projects'&&roots.has(parent)){const root=roots.get(parent);(root.children??=[]).push(item(page));root.overview=root.href;root.overviewLabel=root.label+' öffnen';}}
  const entries=[];let projectsAdded=false;
  for(const page of visible){const parent=menuParent(page);
    if(parent==='')entries.push(roots.get(page.id));
    else if(parent==='@projects'&&!projectsAdded){projectsAdded=true;entries.push({id:'project-navigation',label:'Projekte',children:projectPages.map(item),overview:visible.some(p=>p.id==='home')?'/#projekte':null,overviewLabel:'Alle Projekte'});}
  }
  return entries.filter(p=>p?.href||p?.children?.length);
}
