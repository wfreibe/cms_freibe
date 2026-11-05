import {menuParent} from '../utils/navigation';
import {CmsIcon,IconButton} from './CmsActions';
import { useState } from 'preact/hooks';

const LEGAL_IDS = new Set(['impressum', 'datenschutz']);

function isPublished(section) {
  return section.is_published !== undefined
    ? section.is_published === 1 || section.is_published === true
    : section.is_active === 1 || section.is_active === true;
}

function isInNavigation(section) {
  return section.show_in_navigation !== undefined
    ? section.show_in_navigation === 1 || section.show_in_navigation === true
    : true;
}

export function CMSWorkspace({
  sections,
  language,
  onLanguageChange,
  onEdit,
  onCreate,
  onDelete,
  onOpenWebsite,
  onLogout
}) {
  const [selectedId, setSelectedId] = useState('home');
  const [previewWidth, setPreviewWidth] = useState('desktop');
  const mainSections = sections.filter((section) => !LEGAL_IDS.has(section.id));
  const legalSections = sections.filter((section) => LEGAL_IDS.has(section.id));
  const selected = sections.find((section) => section.id === selectedId) || mainSections[0] || legalSections[0];
  const selectedIsLegal = selected ? LEGAL_IDS.has(selected.id) : false;
  const published = selected ? isPublished(selected) : false;
  const inNavigation = selected ? isInNavigation(selected) : false;

  const renderNav = (items) => items.map((section) => (
    <button
      key={section.id}
      type="button"
      className={`cms-workspace-nav-item ${selected?.id === section.id ? 'is-selected' : ''} ${menuParent(section)?'is-subpage':''}`}
      onClick={() => setSelectedId(section.id)}
      aria-current={selected?.id === section.id ? 'page' : undefined}
    >
      <span className="cms-workspace-nav-icon" aria-hidden="true">{menuParent(section)?'↳':LEGAL_IDS.has(section.id) ? '§' : '◇'}</span>
      <span className="cms-workspace-nav-text">{section.nav_label || section.title}</span>
      <span className={`cms-workspace-nav-dot ${isPublished(section) ? 'is-published' : ''}`} aria-hidden="true" />
    </button>
  ));

  return (
    <div className="cms-workspace">
      <aside className="cms-workspace-sidebar" aria-label="CMS-Navigation" tabIndex={0}>
        <div className="cms-workspace-brand">
          <strong>FREIBERGER<span style="color:#c7254e">.</span><span style="color:#4AD7D1">DESIGN</span></strong>
          <small>REDAKTIONSBEREICH</small>
        </div>

        <div className="cms-workspace-nav-group">
          <p className="cms-workspace-nav-label">IHRE WEBSITE</p>
          <nav aria-label="Seitenbereiche">{renderNav(mainSections)}</nav>
        </div>

        <div className="cms-workspace-nav-group cms-workspace-nav-group-legal">
          <p className="cms-workspace-nav-label">RECHTLICHES</p>
          <nav aria-label="Rechtliche Seiten">{renderNav(legalSections)}</nav>
        </div>

        <div className="cms-workspace-sidebar-bottom">
          <p>Das Design bleibt.<br />Die Inhalte sind in Ihrer Hand.</p>
          <IconButton icon="logout" label="Abmelden" onClick={onLogout}/>
        </div>
      </aside>

      <div className="cms-workspace-shell">
        <header className="cms-workspace-topbar">
          <div className="cms-workspace-breadcrumb">Workspace <span>/</span> <strong>FREIBERGER.DESIGN</strong></div>
          <div className="cms-workspace-top-actions">
            <IconButton icon="external" label="Website ansehen" onClick={onOpenWebsite}/>
            <span className="cms-workspace-avatar" aria-label="Administrator">WF</span>
          </div>
        </header>

        <main className="cms-workspace-main">
          <div className="cms-workspace-heading">
            <div>
              <span className="cms-workspace-eyebrow">WENIG TECHNIK. VIEL FREIRAUM.</span>
              <h1>Raum für Ihre Inhalte.</h1>
              <p>Wählen Sie eine Seite für die Übersicht oder öffnen Sie ihren Editor.</p>
            </div>
            <IconButton icon="plus" label="Neuen Bereich anlegen" onClick={onCreate}/>
          </div>

          <div className="cms-workspace-statusline">
            <span><i aria-hidden="true" /> Redaktionsbereich aktiv</span>
            <span>Änderungen werden beim Speichern im Editor übernommen.</span>
          </div>

          <div className="cms-workspace-grid">
            <section className="cms-workspace-card cms-workspace-details" aria-label="Seitenübersicht">
              <header className="cms-workspace-card-head">
                <div>
                  <span className="cms-workspace-eyebrow">SEITENÜBERSICHT</span>
                  <h2>{selected?.nav_label || 'Seite auswählen'}</h2>
                  <p className="cms-overview-saved">Gespeicherter Stand</p>
                </div>
                <div className="cms-workspace-languages" role="group" aria-label="Anzeigesprache">
                  <button type="button" className={language === 'de' ? 'is-active' : ''} aria-pressed={language === 'de'} onClick={() => onLanguageChange('de')}>DE</button>
                  <button type="button" className={language === 'en' ? 'is-active' : ''} aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
                  <button type="button" className={language === 'fr' ? 'is-active' : ''} aria-pressed={language === 'fr'} onClick={() => onLanguageChange('fr')}>FR</button>
                </div>
              </header>

              {selected ? (
                <div className="cms-workspace-card-body">
                  <div className="cms-overview-editbar">
                    <button type="button" className="cms-workspace-button cms-workspace-button-primary cms-overview-edit" onClick={()=>onEdit(selected)}><CmsIcon name="edit"/> Inhalt bearbeiten</button>
                    <p>Änderungen nehmen Sie im Editor vor.</p>
                  </div>
                  <dl className="cms-overview-facts">
                    <div><dt>Menüpunkt</dt><dd>{selected.nav_label||'—'}</dd></div>
                    <div><dt>Überschrift</dt><dd>{selected.title||'—'}</dd></div>
                    <div><dt>Untertitel</dt><dd>{selected.subtitle||'Kein Untertitel'}</dd></div>
                    <div className="cms-overview-status-row"><dt>Veröffentlichung</dt><dd><span className={'cms-overview-status'+(published?' is-on':'')}><i aria-hidden="true"/>{published?'Veröffentlicht':'Entwurf'}</span></dd></div>
                    {!selectedIsLegal&&<div className="cms-overview-status-row"><dt>Hauptnavigation</dt><dd><span className={'cms-overview-status'+(inNavigation?' is-on':'')}><i aria-hidden="true"/>{inNavigation?'Im Menü':'Ausgeblendet'}</span></dd></div>}
                    <div><dt>Menüzuordnung</dt><dd>{menuParent(selected)==='@projects'?'Unter Projekte':menuParent(selected)?'Unter '+(sections.find(p=>p.id===menuParent(selected))?.nav_label||menuParent(selected)):'Hauptmenü'}</dd></div>
                  </dl>
                  <details key={selected.id} className="cms-overview-technical"><summary>Weitere Angaben</summary>
                    <dl><dt>Bereichs-ID</dt><dd><code>{selected.id}</code></dd></dl>
                    {!selectedIsLegal&&selected.id!=='home'&&selected.id!=='kontakt'&&<button type="button" className="cms-workspace-button cms-workspace-button-danger" onClick={()=>onDelete(selected)}><CmsIcon name="trash"/> Seite löschen</button>}
                  </details>
                </div>
              ) : (
                <div className="cms-workspace-card-body"><p>Für diese Sprache sind noch keine Bereiche angelegt.</p></div>
              )}
            </section>

            <aside className="cms-workspace-card cms-workspace-preview" aria-label="Inhaltsvorschau">
              <header className="cms-workspace-preview-head">
                <div><i aria-hidden="true" /> <strong>Inhaltsvorschau</strong></div>
                <div className="cms-workspace-devices" role="group" aria-label="Vorschaubreite">
                  <IconButton icon="monitor" className={previewWidth === 'desktop' ? 'is-active' : ''} label="Desktop-Vorschau" aria-pressed={previewWidth === 'desktop'} onClick={() => setPreviewWidth('desktop')}/>
                  <IconButton icon="phone" className={previewWidth === 'mobile' ? 'is-active' : ''} label="Mobil-Vorschau" aria-pressed={previewWidth === 'mobile'} onClick={() => setPreviewWidth('mobile')}/>
                </div>
              </header>
              <p className="cms-workspace-preview-note">Gespeicherter Inhalt · Originalgestaltung</p>
              <div className={`cms-workspace-preview-area ${previewWidth === 'mobile' ? 'is-mobile' : ''}`}>
                {selected ? (
                  <iframe
                    className="cms-website-frame"
                    key={selected.id + ':' + selected.updated_at + ':' + selected.content.length + ':' + selected.image_layout + ':' + selected.image_url + ':' + selected.bg_image_url + ':' + JSON.stringify(selected.content_blocks)}
                    title={'Webseitenvorschau: ' + selected.title}
                    src={'/cms/preview/' + encodeURIComponent(selected.id)}
                  />
                ) : <p>Keine Vorschau verfügbar.</p>}
              </div>
              <footer className="cms-workspace-preview-foot">
                <span>{language.toUpperCase()} · {published ? 'Veröffentlicht' : 'Entwurf'}</span>
                <IconButton icon="external" label="Zur Website" onClick={onOpenWebsite}/>
              </footer>
            </aside>
          </div>

          <footer className="cms-workspace-footer">
            <span>FREIBERGER.DESIGN · CMS</span>
            <span>Inhalte pflegen. Wirkung zeigen.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
