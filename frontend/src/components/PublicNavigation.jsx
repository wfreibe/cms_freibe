import routes from '../page-routes.json';
import {buildNavigation} from '../utils/navigation';

export function PublicNavigation({sections,currentId,onNavigate}) {
  const follow=event=>{
    const disclosure=event.currentTarget.closest('details');
    if(disclosure)disclosure.open=false;
    onNavigate?.();
  };
  return buildNavigation(sections,routes).map(item=>item.children?
    <details key={item.id} className="project-navigation">
      <summary className={item.children.some(p=>p.id===currentId)||item.id===currentId?'is-current':''}>{item.label}</summary>
      <ul className="project-navigation-links">
        {item.overview&&<li><a href={item.overview} onClick={follow}>{item.overviewLabel||item.label}</a></li>}
        {item.children.map(child=><li key={child.id}><a href={child.href} aria-current={child.id===currentId?'page':undefined} onClick={follow}>{child.label}</a></li>)}
      </ul>
    </details>:
    <a key={item.id} href={item.href} aria-current={item.id===currentId?'page':undefined} onClick={follow}>{item.label}</a>
  );
}
