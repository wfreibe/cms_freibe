// Background fields accept hexadecimal colors from the CMS picker.
export function backgroundColor(value) {
 if(typeof value!=='string')return '';
 const color=value.trim().toLowerCase();
 if(/^#[0-9a-f]{6}$/.test(color))return color;
 if(/^#[0-9a-f]{3}$/.test(color))return '#'+[...color.slice(1)].map(c=>c+c).join('');
 return '';
}
export function luminance(color) {
 const rgb=backgroundColor(color);
 if(!rgb)throw new TypeError('Expected a hexadecimal color');
 const values=[1,3,5].map(i=>parseInt(rgb.slice(i,i+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
 return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;
}
export function contrast(a,b) {
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
export function backgroundAppearance(color,image) {
 const normalized=backgroundColor(color);
 if(!normalized&&!image)return {};
 const foreground=image?'#ffffff':contrast(normalized,'#ffffff')>=4.5?'#ffffff':contrast(normalized,'#111316')>=4.5?'#111316':'#000000';
 return {
  ...(normalized?{backgroundColor:normalized}:{}),
  ...(image?{backgroundImage:'linear-gradient(rgba(17,19,22,.86),rgba(17,19,22,.86)),url('+JSON.stringify(image)+')'}:{}),
  '--page-foreground':foreground,
  '--page-border':foreground==='#ffffff'?'#ffffff66':'#11131655'
 };
}
