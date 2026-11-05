export const blockTypes = [
  ['text','Text'], ['image','Bild mit Text'], ['slideshow','Slideshow'],
  ['accordion','Akkordeon'], ['youtube','YouTube-Video'], ['audio','Audio'], ['link','Link / Schaltfläche']
];
export const imageDefaults = {format:'original',layout:'above',align:'center',width:100,focus_x:50,focus_y:50};
export const blockId = () => 'b_' + crypto.randomUUID().replaceAll('-','');
export function pageBlocks(value) {
  return Array.isArray(value) ? value : [{id:'existing-content',type:'legacy',enabled:true,data:{}}];
}
export function createBlock(type) {
  const data = {
    text:{title:'',html:''},
    image:{title:'',html:'',src:'',alt:'',caption:'',options:{...imageDefaults}},
    slideshow:{title:'',images:[],interval:5},
    accordion:{title:'',items:[]},
    youtube:{title:'',video:'',cover:'',caption:''},
    audio:{title:'',src:'',caption:''},
    link:{title:'',href:'',label:'',style:'button'},
    legacy:{}
  }[type];
  if (!data) throw new Error('Unbekannter Bausteintyp.');
  return {id:blockId(),type,enabled:true,data};
}
export function moveBlock(blocks,from,to) {
  if(from===to || from<0 || from>=blocks.length || to<0 || to>=blocks.length)return blocks;
  const next=[...blocks];next.splice(to,0,next.splice(from,1)[0]);return next;
}
export function youtubeId(value='') {
  if(typeof value!=='string')return '';
  value=value.trim();
  if(/^[A-Za-z0-9_-]{11}$/.test(value))return value;
  try {
    const u=new URL(value);
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return '';
    let id='';
    if(u.hostname==='youtu.be')id=u.pathname.replace(/^\/|\/$/g,'');
    else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(u.hostname)){
      id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:'';
  }catch{return '';}
}
function localPath(value) {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return false;
  try{const decoded=decodeURIComponent(value);return !decoded.startsWith('//')&&!/[\u0000-\u0020\\]/.test(decoded)&&!/(^|\/)\.\.?($|\/)/.test(decoded);}catch{return false;}
}
export function localImage(value) {
  return localPath(value)&&(/^\/api\/media\/[a-f0-9]{32}$/.test(value)||/^\/[a-zA-Z0-9_./%-]+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value));
}
export function localAudio(value) {return localPath(value)&&/^\/[a-zA-Z0-9_./%-]+\.(mp3|ogg|wav|m4a)$/i.test(value);}
export function safeBlockLink(value) {
  if(typeof value!=='string'||/[\u0000-\u0020\\]/.test(value))return '';
  if(localPath(value))return value;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?value:'';}catch{return '';}
}
