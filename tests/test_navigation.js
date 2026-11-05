'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const {buildNavigation,pageHref,isMenuPage}=await import('../frontend/src/utils/navigation.js');
 const routes=JSON.parse(fs.readFileSync(path.join(__dirname,'../frontend/src/page-routes.json'),'utf8'));
 const page=(id,sort_order,extra={})=>({id,sort_order,title:id,nav_label:id,is_published:1,show_in_navigation:1,...extra});
 const pages=[page('t',12,{nav_label:'Mein Test'}),page('project-f_m',6),page('hidden',0,{show_in_navigation:0}),page('home',1),page('draft',0,{is_published:0}),page('contact',3),page('project-l1_p',4),page('aboutme',2),page('legalnotice',10),page('dsgvo',11)];
 assert.equal(pageHref('t',routes,'/mein-test'),'/mein-test');
 assert.equal(pageHref('t',routes,'//example.org'),'/section/t');
 assert.equal(buildNavigation([page('t',1,{url_path:'/mein-test'})],routes)[0].href,'/mein-test');
 const saved=JSON.stringify(pages);
 let nav=buildNavigation(pages,routes);
 assert.deepEqual(nav.map(p=>p.id),['home','aboutme','contact','project-navigation','legalnotice','dsgvo','t']);
 assert.deepEqual(nav.find(p=>p.children).children.map(p=>p.id),['project-l1_p','project-f_m']);
 assert.equal(nav.find(p=>p.id==='t').label,'Mein Test');assert.equal(nav.find(p=>p.id==='t').href,'/section/t');
 assert.equal(pageHref('project-l1_p',routes),'/project/L1_p');assert.equal(pageHref('home',routes),'/');
 assert.equal(pageHref('//evil.example',routes),'');assert.equal(pageHref('x?foo',routes),'');
 assert.equal(JSON.stringify(pages),saved,'Navigation changed source records');
 nav=buildNavigation(pages.map(p=>p.id==='t'?{...p,sort_order:0}:p),routes);assert.equal(nav[0].id,'t');
 for(const flag of ['is_published','show_in_navigation']){
  nav=buildNavigation(pages.map(p=>p.id==='t'?{...p,[flag]:false}:p),routes);assert(!nav.some(p=>p.id==='t'));
 }
 nav=buildNavigation([page('project-f_m',1)],routes);assert.equal(nav[0].overview,null);
 assert.deepEqual(buildNavigation([page('project-f_m',1,{show_in_navigation:0})],routes),[]);
 assert(isMenuPage({is_active:true,show_in_navigation:true}));assert(!isMenuPage({is_published:0,is_active:1,show_in_navigation:1}));
 const ties=buildNavigation([page('second',1),page('first',1)],routes);assert.deepEqual(ties.map(p=>p.id),['second','first']);

 const grouped=[page('parent',8,{nav_label:'Leistungen',url_path:'/leistungen',menu_parent:''}),page('child',2,{menu_parent:'parent',url_path:'/beratung'}),page('child-late',9,{menu_parent:'parent'}),page('project-free',1,{menu_parent:''}),page('ordinary-project',5,{menu_parent:'@projects'})];
 nav=buildNavigation(grouped,routes);
 assert.deepEqual(nav.map(p=>p.id),['project-free','project-navigation','parent']);
 assert.deepEqual(nav.find(p=>p.id==='parent').children.map(p=>p.id),['child','child-late']);
 assert.equal(nav.find(p=>p.id==='parent').overview,'/leistungen');
 assert.equal(nav.find(p=>p.id==='parent').children[0].href,'/beratung');
 for(const flags of [{show_in_navigation:0},{is_published:0}])assert(!buildNavigation(grouped.map(p=>p.id==='parent'?{...p,...flags}:p),routes).some(p=>p.id==='parent'||p.id==='child'));
 assert(!buildNavigation([page('orphan',1,{menu_parent:'missing'})],routes).length);
 assert.equal(buildNavigation([page('plain',1,{menu_parent:''})],routes)[0].id,'plain');

 console.log('Navigation passed: CMS labels, historical/new URLs, publication/visibility, sorting and stable ties, project grouping, empty groups and immutable inputs.');
})().catch(e=>{console.error(e);process.exitCode=1;});
