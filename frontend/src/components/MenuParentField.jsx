import {menuParent} from '../utils/navigation';
export function MenuParentField({value='',onChange,pages=[],pageId='',hasChildren=false}) {
 const seen=new Set();
 const options=pages.filter(p=>p.id!==pageId&&menuParent(p)===''&&!seen.has(p.id)&&seen.add(p.id));
 const fixed=pageId==='home'||hasChildren;
 return <div className="form-group">
 <label>Übergeordneter Menüpunkt<select aria-label="Übergeordneter Menüpunkt" value={value} disabled={fixed} onChange={e=>onChange(e.target.value)} style={{display:'block',width:'100%',padding:10,marginTop:6}}>
 <option value="">Hauptmenü (direkt sichtbar)</option>
 <option value="@projects">Projekte</option>
 {options.map(p=><option key={p.id} value={p.id}>{p.nav_label||p.title||p.id}{!(p.is_published??p.is_active)||p.show_in_navigation===false||p.show_in_navigation===0?' (ausgeblendet)':''}</option>)}
 </select></label>
 <p className="block-editor-hint">{fixed?(pageId==='home'?'Die Startseite bleibt im Hauptmenü.':'Dieser Menüpunkt hat Unterseiten und bleibt im Hauptmenü. Zum Verschieben zuerst die Unterseiten neu zuordnen.'):'Die Seite erscheint unter dem ausgewählten Menüpunkt. Reihenfolge gilt innerhalb dieses Menüs. Die Seitenadresse bleibt unverändert.'}</p>
 <p className="block-editor-hint">Ein Untermenü erscheint nur, wenn der Hauptmenüpunkt veröffentlicht und im Menü sichtbar ist.</p>
 </div>;
}
