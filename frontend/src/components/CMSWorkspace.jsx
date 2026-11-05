import {menuParent} from '../utils/navigation';
import {IconButton} from './CmsActions';
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
  onTogglePublished,
  onToggleNavigation,
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
              <p>Wählen Sie einen Bereich und bearbeiten Sie die Inhalte Ihrer Website.</p>
            </div>
            <IconButton icon="plus" label="Neuen Bereich anlegen" onClick={onCreate}/>
          </div>

          <div className="cms-workspace-statusline">
            <span><i aria-hidden="true" /> Redaktionsbereich aktiv</span>
            <span>Änderungen werden beim Speichern im Editor übernommen.</span>
          </div>

          <div className="cms-workspace-grid">
            <section className="cms-workspace-card cms-workspace-details" aria-label="Bereich verwalten">
              <header className="cms-workspace-card-head">
                <div>
                  <span className="cms-workspace-eyebrow">INHALTE</span>
                  <h2>{selected?.nav_label || 'Bereich auswählen'}</h2>
                </div>
                <div className="cms-workspace-languages" role="group" aria-label="Bearbeitungssprache">
                  <button type="button" className={language === 'de' ? 'is-active' : ''} aria-pressed={language === 'de'} onClick={() => onLanguageChange('de')}>DE</button>
                  <button type="button" className={language === 'en' ? 'is-active' : ''} aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
                  <button type="button" className={language === 'fr' ? 'is-active' : ''} aria-pressed={language === 'fr'} onClick={() => onLanguageChange('fr')}>FR</button>
                </div>
              </header>

              {selected ? (
                <div className="cms-workspace-card-body">
                  <p className="cms-workspace-help">Die Details bearbeiten Sie im bestehenden CMS-Editor. Die Vorschau zeigt den aktuell gespeicherten Inhalt.</p>
                  <div className="cms-workspace-field">
                    <span>Menüpunkt</span>
                    <strong>{selected.nav_label || '—'}</strong>
                  </div>
                  <div className="cms-workspace-field">
                    <span>Überschrift</span>
                    <strong>{selected.title || '—'}</strong>
                  </div>
                  <div className="cms-workspace-field">
                    <span>Untertitel</span>
                    <strong>{selected.subtitle || '—'}</strong>
                  </div>
                  <div className="cms-workspace-field cms-workspace-field-status">
                    <span>Veröffentlichung</span>
                    {selectedIsLegal ? (
                      <span className={`cms-workspace-pill ${published ? 'is-on' : ''}`}>
                        {published ? '● Veröffentlicht' : '○ Entwurf'}
                      </span>
                    ) : (
                      <button type="button" className={`cms-workspace-pill ${published ? 'is-on' : ''}`} aria-label={`${selected.title}: ${published ? 'Veröffentlicht' : 'Entwurf'}. Status ändern`} onClick={() => onTogglePublished(selected)}>
                        {published ? '● Veröffentlicht' : '○ Entwurf'}
                      </button>
                    )}
                  </div>
                  {!selectedIsLegal && (
                    <div className="cms-workspace-field cms-workspace-field-status">
                      <span>Hauptnavigation</span>
                      <button type="button" className={`cms-workspace-pill ${inNavigation ? 'is-on' : ''}`} aria-label={`${selected.title}: ${inNavigation ? 'Im Menü' : 'Nicht im Menü'}. Status ändern`} onClick={() => onToggleNavigation(selected)}>
                        {inNavigation ? '● Im Menü' : '○ Ausgeblendet'}
                      </button>
                    </div>
                  )}
                  <div className="cms-workspace-field">
                    <span>Menüzuordnung</span>
                    <strong>{menuParent(selected)==='@projects'?'Unter Projekte':menuParent(selected)?'Unter '+(sections.find(p=>p.id===menuParent(selected))?.nav_label||menuParent(selected)):'Hauptmenü'}</strong>
                  </div>
                  <div className="cms-workspace-field">
                    <span>Bereichs-ID</span>
                    <code>{selected.id}</code>
                  </div>
                  <div className="cms-workspace-actions">
                    <IconButton icon="edit" label="Inhalt bearbeiten" onClick={() => onEdit(selected)}/>
                    {!selectedIsLegal && selected.id !== 'home' && selected.id !== 'kontakt' && (
                      <IconButton icon="trash" danger label="Bereich löschen" onClick={() => onDelete(selected)}/>
                    )}
                  </div>
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
