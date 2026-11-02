import '../styles/image-layout.css';
export function PageImageLayout({src,alt='',mode='original',children}){
 if(!src)return children;
 const layout=['original','wide','left','right'].includes(mode)?mode:'original';
 return <div className={'page-image-layout image-layout-'+layout}><figure className="page-image-figure"><img src={src} alt={alt} decoding="async"/></figure><div className="page-image-copy">{children}</div></div>;
}
