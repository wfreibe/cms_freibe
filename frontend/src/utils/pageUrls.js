export function slugify(value='') {
  return value.replace(/[ÄÖÜäöüßẞ]/g,c=>({'Ä':'Ae','Ö':'Oe','Ü':'Ue','ä':'ae','ö':'oe','ü':'ue','ß':'ss','ẞ':'SS'}[c]))
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export function proposedPath(value,menuName,currentPath) {
  if(value.trim())return '/'+slugify(value);
  if(currentPath&&!currentPath.startsWith('/section/'))return currentPath;
  return '/'+slugify(menuName);
}
