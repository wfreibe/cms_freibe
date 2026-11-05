import '../styles/cms-actions.css';

const paths = {
 up:'m6 14 6-6 6 6M12 8v12', down:'m6 10 6 6 6-6M12 4v12',
 drag:'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',
 trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
 edit:'m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 eyeOff:'m3 3 18 18M9 5.5A12 12 0 0 1 12 5c6 0 10 7 10 7a21 21 0 0 1-3 4M6 6a22 22 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1M10 10a3 3 0 0 0 4 4',
 imageAdd:'M19 11V4H3v16h10M3 16l5-5 5 5 3-3M7 8h.01M18 14v8M14 18h8',
 replace:'M20 10V4H4v16h8M4 16l5-5 4 4M8 8h.01M15 16a4 4 0 1 1 0 5M15 13v4h4',
 plus:'M12 4v16M4 12h16', close:'m6 6 12 12M6 18 18 6',
 external:'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
 monitor:'M3 3h18v13H3ZM12 16v5M8 21h8',
 phone:'M7 2h10v20H7ZM11 18h2',
 link:'m10 13 4-4M8 15l-2 2a3.5 3.5 0 0 0 5 5l4-4a3.5 3.5 0 0 0 0-5M16 9l2-2a3.5 3.5 0 0 0-5-5L9 6a3.5 3.5 0 0 0 0 5',
 unlink:'m3 3 18 18M8 15l-2 2a3.5 3.5 0 0 0 5 5l3-3M16 9l2-2a3.5 3.5 0 0 0-5-5l-3 3',
 list:'M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01',
 numbers:'M10 6h11M10 12h11M10 18h11M3 3h1v6M2 9h4M2 15a2 2 0 0 1 4 0c0 2-4 2-4 5h4',
 bold:'M6 3h7a4.5 4.5 0 0 1 0 9H6ZM6 12h8a4.5 4.5 0 0 1 0 9H6Z',
 italic:'M10 3h10M4 21h10M15 3 9 21',
 clear:'M4 4h16M12 4l-4 14M15 15l6 6M15 21l6-6',
 undo:'m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14',
 redo:'m16 4 5 5-5 5M21 9H11a7 7 0 0 0 0 14',
 code:'m8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18',
 logout:'M10 3H3v18h7M9 12h12m-5-5 5 5-5 5'
};

export function CmsIcon({name}) {
 return <svg className="cms-action-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width={name==='drag'?3:1.8} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]||paths.edit}/></svg>;
}
export function IconButton({icon,label,className='',danger=false,...props}) {
 return <button type="button" {...props} className={'cms-icon-button '+(danger?'cms-icon-danger ':'')+className} aria-label={label} title={label} data-tooltip={label}><CmsIcon name={icon}/></button>;
}
/** Keep the real file input keyboard accessible and preserve the native picker. */
export function IconUpload({label,replace=false,className='',...props}) {
 return <label className={'cms-icon-upload '+className} title={label} data-tooltip={label}><CmsIcon name={replace?'replace':'imageAdd'}/><input type="file" {...props} aria-label={label}/></label>;
}
