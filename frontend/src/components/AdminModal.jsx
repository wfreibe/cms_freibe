import {unifiedBlocks} from '../utils/unifiedBlocks';
import {MenuParentField} from './MenuParentField';
import {menuParent} from '../utils/navigation';
import {BackgroundColorPicker} from './BackgroundColorPicker';
import {IconButton} from './CmsActions';
import {PageUrlField} from './PageUrlField';
import { ContentBlocks } from './ContentBlocks';
import { ContentBlocksEditor } from './ContentBlocksEditor';
import { SectionImageUpload } from './SectionImageUpload';
import { useState, useEffect } from 'preact/hooks';
import { useI18n } from '../context/I18nContext';

export function AdminModal() {
  const {
    activeEditSection,
    setActiveEditSection,
    language,
    t,
    fetchSections,
    fetchCmsSections,
    updateSectionLocal,
    csrfToken,
    setIsAuthenticated,
    cmsSections,
    sections
  } = useI18n();

  const [form, setForm] = useState({
    nav_label: '',
    url_slug: '',
    menu_parent: '',
    title: '',
    subtitle: '',
    content: '',
    content_blocks: [],
    image_url: '',
    image_layout: 'original',
    bg_color: '',
    bg_image_url: '',
    contact_info: {
      company: '',
      role: '',
      email: '',
      phone: '',
      web: '',
      note: ''
    },
    is_active: false,
    is_published: false,
    sort_order: 1,
    accordions: []
  });
  const [conversionError,setConversionError]=useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [pendingUploads, setPendingUploads] = useState(0);
  const uploadBusy = pendingUploads > 0;
  const setUploadBusy = busy => setPendingUploads(count => Math.max(0, count + (busy ? 1 : -1)));

  useEffect(() => {
    if (activeEditSection) {
      let contactInfoObj = { company: '', role: '', email: '', phone: '', web: '', note: '' };
      if (activeEditSection.contact_info) {
        const parsed = typeof activeEditSection.contact_info === 'string'
          ? JSON.parse(activeEditSection.contact_info)
          : activeEditSection.contact_info;
        contactInfoObj = { ...contactInfoObj, ...(parsed || {}) };
      }

      const isLegal = activeEditSection.id === 'impressum' || activeEditSection.id === 'datenschutz';
      const isPub = activeEditSection.is_published !== undefined
        ? !!activeEditSection.is_published
        : (activeEditSection.is_active !== undefined ? !!activeEditSection.is_active : true);
      const showNav = activeEditSection.show_in_navigation !== undefined
        ? !!activeEditSection.show_in_navigation
        : (!isLegal && isPub);

      let elements;try{elements=unifiedBlocks(activeEditSection);setConversionError('');}catch(error){elements=[];setConversionError(error.message);}
      setForm({
        nav_label: activeEditSection.id === 'home' && activeEditSection.nav_label === activeEditSection.title ? 'Home' : (activeEditSection.nav_label || ''),
        url_slug: activeEditSection.url_slug || '',
        menu_parent: menuParent(activeEditSection),
        title: activeEditSection.title || '',
        subtitle: activeEditSection.subtitle || '',
        content: activeEditSection.content || '',
        content_blocks: elements,
        image_url: activeEditSection.image_url || '',
        image_layout: activeEditSection.image_layout || 'original',
        bg_color: activeEditSection.bg_color || '',
        bg_image_url: activeEditSection.bg_image_url || '',
        contact_info: contactInfoObj,
        is_published: isPub,
        show_in_navigation: showNav,
        is_active: isPub,
        sort_order: activeEditSection.sort_order || 1,
        accordions: activeEditSection.accordions ? JSON.parse(JSON.stringify(activeEditSection.accordions)) : []
      });
      setStatus({ state: 'idle', message: '' });
    }
  }, [activeEditSection]);

  const isLegalPage = activeEditSection?.id === 'impressum' || activeEditSection?.id === 'datenschutz';

  const allSectionsList=(cmsSections&&cmsSections.length?cmsSections:sections)||[];

  const handleSave = async (e) => {
    e.preventDefault();
    if (uploadBusy||conversionError) return;
    setStatus({ state: 'saving', message: t('saving') });

    const effectivePublished = form.is_published ? 1 : 0;
    const effectiveNav = isLegalPage ? 0 : (form.show_in_navigation ? 1 : 0);

    try {
      const res = await fetch(`/api/sections/${activeEditSection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          lang: language,
          nav_label: form.nav_label,
          url_slug: form.url_slug,
          menu_parent: form.menu_parent,
          title: form.title,
          subtitle: form.subtitle,
          content: form.content,
          content_blocks: form.content_blocks,
          image_layout: form.image_layout,
          image_url: form.image_url ? form.image_url.trim() : null,
          bg_color: form.bg_color ? form.bg_color.trim() : null,
          bg_image_url: form.bg_image_url ? form.bg_image_url.trim() : null,
          contact_info: activeEditSection.id === 'kontakt' ? form.contact_info : undefined,
          is_published: effectivePublished,
          show_in_navigation: effectiveNav,
          is_active: effectivePublished,
          sort_order: form.sort_order,
          accordions: form.accordions
        })
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_) {
        data = null;
      }

      if (res.status === 401) {
        setIsAuthenticated(false);
        setStatus({
          state: 'error',
          message: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich im CMS erneut an.'
        });
        return;
      }

      if (res.ok) {
        updateSectionLocal({
          id: activeEditSection.id,
          nav_label: form.nav_label,
          url_slug: form.url_slug,
          menu_parent: form.menu_parent,
          title: form.title,
          subtitle: form.subtitle,
          content: form.content,
          content_blocks: form.content_blocks,
          image_layout: form.image_layout,
          image_url: form.image_url ? form.image_url.trim() : null,
          bg_color: form.bg_color ? form.bg_color.trim() : null,
          bg_image_url: form.bg_image_url ? form.bg_image_url.trim() : null,
          contact_info: activeEditSection.id === 'kontakt' ? form.contact_info : undefined,
          is_published: effectivePublished,
          show_in_navigation: effectiveNav,
          is_active: effectivePublished,
          sort_order: form.sort_order,
          accordions: form.accordions
        });
        await fetchSections(language);
        await fetchCmsSections(language);
        setStatus({ state: 'success', message: t('updateSuccess') });
        setTimeout(() => {
          setActiveEditSection(null);
        }, 900);
      } else {
        const errorMsg = (data && data.error)
          ? data.error
          : `Fehler beim Speichern (HTTP ${res.status}). Bitte Serverrechte prüfen.`;
        setStatus({
          state: 'error',
          message: errorMsg
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
      setStatus({
        state: 'error',
        message: `Verbindungsfehler: Das Backend konnte nicht erreicht werden (${err.message}).`
      });
    }
  };

  if (!activeEditSection) return null;


  return (
    <div className="modal-overlay cms-editor-overlay" onClick={() => setActiveEditSection(null)}>
      <div className="modal-content cms-editor-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="cms-editor-title">
            <span className="cms-editor-eyebrow">INHALTE BEARBEITEN · {language.toUpperCase()}</span>
            <h3>{activeEditSection.nav_label || activeEditSection.title} bearbeiten</h3>
            <p>Änderungen werden mit „Speichern“ übernommen.</p>
          </div>
          <IconButton icon="close" label="Editor schließen" onClick={()=>setActiveEditSection(null)}/>
        </div>

        <form onSubmit={handleSave}>
          <div className="cms-editor-shell">
          <div className="modal-body">
            {status.state === 'success' && (
              <div className="alert-success">{status.message}</div>
            )}
            {status.state === 'error' && (
              <div className="alert-error" style={{ color: '#914c5e', fontWeight: 600, marginBottom: '15px' }}>
                {status.message}
              </div>
            )}

            {/* Menüname (nur bei normalen Sektionen) */}
            {!isLegalPage && (
              <div className="form-group">
                <label><strong>{t('navLabel')}</strong></label>
                <input
                  type="text"
                  value={form.nav_label}
                  onInput={(e) => setForm({ ...form, nav_label: e.target.value })}
                  placeholder="z. B. Über Uns"
                  required
                />
              </div>
            )}

            <MenuParentField value={form.menu_parent} onChange={menu_parent=>setForm(prev=>({...prev,menu_parent}))} pages={allSectionsList} pageId={activeEditSection.id} hasChildren={allSectionsList.some(p=>menuParent(p)===activeEditSection.id)}/>

            <PageUrlField value={form.url_slug} onChange={url_slug=>setForm(prev=>({...prev,url_slug}))} menuName={form.nav_label} currentPath={activeEditSection.url_path} home={activeEditSection.id==='home'}/>

            {/* Titel */}
            <div className="form-group">
              <label><strong>{t('sectionTitle')}</strong></label>
              <input
                type="text"
                value={form.title}
                onInput={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            {/* Untertitel */}
            <div className="form-group">
              <label>{t('sectionSubtitle')}</label>
              <input
                type="text"
                value={form.subtitle}
                onInput={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>

            {!isLegalPage&&<details className="page-design-settings"><summary>Seitengestaltung: Farbe und Hintergrundbild</summary><BackgroundColorPicker value={form.bg_color} onChange={bg_color=>setForm(prev=>({...prev,bg_color}))}/><SectionImageUpload kind="background" value={form.bg_image_url} onChange={bg_image_url=>setForm(prev=>({...prev,bg_image_url}))} csrfToken={csrfToken} onBusyChange={setUploadBusy} disabled={uploadBusy}/></details>}
            {conversionError&&<p role="alert">{conversionError} Die Speicherung ist gesperrt; Ihre bisherigen Inhalte bleiben erhalten.</p>}
            <ContentBlocksEditor key={activeEditSection.id+':blocks:'+language} blocks={form.content_blocks} onChange={content_blocks=>setForm(prev=>({...prev,content_blocks}))} csrfToken={csrfToken} onBusyChange={setUploadBusy} busy={uploadBusy||!!conversionError}/>

            {/* Status Veröffentlicht / Entwurf */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '15px 0' }}>
              <input
                type="checkbox"
                id="is_published_checkbox"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked, is_active: e.target.checked })}
                style={{ width: 'auto', margin: 0 }}
              />
              <label htmlFor="is_published_checkbox" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                <strong>Sektion veröffentlichen</strong> (auf Website aufrufbar)
              </label>
            </div>

            {/* Status Hauptnavigation (nur bei regulären Inhalts-Sektionen) */}
            {!isLegalPage && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0 15px' }}>
                <input
                  type="checkbox"
                  id="show_in_navigation_checkbox"
                  checked={form.show_in_navigation}
                  onChange={(e) => setForm({ ...form, show_in_navigation: e.target.checked })}
                  style={{ width: 'auto', margin: 0 }}
                />
                <label htmlFor="show_in_navigation_checkbox" style={{ margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                  <strong>In Hauptnavigation anzeigen</strong> (im Header-Menü auflisten)
                </label>
              </div>
            )}

            {/* Sortierung */}
            {!isLegalPage && (
              <div style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                <div className="form-group" style={{ width: '120px', margin: 0 }}>
                  <label style={{ fontSize: '11px' }}>{t('sortOrderLabel')}</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onInput={(e) => setForm({ ...form, sort_order: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>
          <aside className="cms-editor-preview" aria-label="Vorschau der aktuellen Eingaben">
            <div className="cms-editor-preview-heading">
              <span className="cms-editor-preview-dot" aria-hidden="true" />
              <strong>Inhaltsvorschau</strong>
              <small>Aktuelle Eingaben</small>
            </div>
            <p className="cms-editor-preview-note">Live-Vorschau · noch nicht gespeichert</p>
            <div className="cms-editor-preview-stage">
              <div className="cms-editor-preview-paper">
                <h4>{form.title || 'Überschrift'}</h4>
                {form.subtitle && <p className="cms-editor-preview-subtitle">{form.subtitle}</p>}
                <div className="cms-editor-preview-copy"><ContentBlocks page={{...form,id:activeEditSection.id}} preview /></div>
              </div>
            </div>
            <div className="cms-editor-preview-foot">{language.toUpperCase()} · {form.is_published ? 'Veröffentlicht' : 'Entwurf'}</div>
          </aside>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveEditSection(null)}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={status.state === 'saving' || uploadBusy || !!conversionError}
            >
              {status.state === 'saving' ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
