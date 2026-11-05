import '../styles/image-layout.css';
export function PageImageLayout({src,alt='',mode='original',options,children}){
 if(!src)return children;
 const layout=['original','wide','left','right'].includes(mode)?mode:'original';
 return <div className={'page-image-layout image-layout-'+layout}><figure className="page-image-figure"><img src={src} alt={alt} decoding="async" style={options?{width:options.width+'%',marginLeft:options.align==='left'?0:'auto',marginRight:options.align==='right'?0:'auto',aspectRatio:options.format==='original'?'auto':options.format.replace(':',' / '),objectFit:options.format==='original'?'contain':'cover',objectPosition:options.focus_x+'% '+options.focus_y+'%'}:undefined}/></figure><div className="page-image-copy">{children}</div></div>;
}
