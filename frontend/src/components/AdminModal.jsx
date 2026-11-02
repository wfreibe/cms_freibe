import { PageImageLayout } from './PageImageLayout';
import { SectionImageUpload } from './SectionImageUpload';
import { RichTextEditor } from './RichTextEditor';
import { SlideshowEditor } from './SlideshowEditor';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useI18n } from '../context/I18nContext';
import { WebsiteContent } from './WebsiteContent';

// Helper component for picking and inserting an accordion jump link
function AccordionLinkPicker({
  availableSections,
  onInsert,
  onClose,
  initialSelectedText = '',
  t
}) {
  const allFlattened = [];
  availableSections.forEach((sec) => {
    (sec.accordions || []).forEach((acc) => {
      allFlattened.push({
        id: acc.id,
        title: acc.title,
        sectionTitle: sec.sectionTitle
      });
    });
  });

  const [targetId, setTargetId] = useState(allFlattened[0]?.id || '');
  const [linkText, setLinkText] = useState(
    initialSelectedText.trim() || (allFlattened[0] ? `➔ ${allFlattened[0].title}` : '')
  );
  const [styleMode, setStyleMode] = useState(initialSelectedText ? 'inline' : 'arrow');
  const [justInserted, setJustInserted] = useState(false);

  const handleSelectAcc = (accId) => {
    setTargetId(accId);
    const found = allFlattened.find((a) => a.id === accId);
    if (found && !initialSelectedText) {
      if (styleMode === 'arrow' || styleMode === 'block') {
        setLinkText(`➔ ${found.title}`);
      } else {
        setLinkText(found.title);
      }
    }
  };

  const handleStyleChange = (mode) => {
    setStyleMode(mode);
    const found = allFlattened.find((a) => a.id === targetId);
    const baseTitle = (found ? found.title : linkText).replace(/^➔\s*/, '');
    if (mode === 'arrow' || mode === 'block') {
      setLinkText(`➔ ${baseTitle}`);
    } else {
      setLinkText(baseTitle);
    }
  };

  const handleConfirm = () => {
    if (!targetId) return;
    const cleanText = linkText.trim() || (allFlattened.find((a) => a.id === targetId)?.title || 'Link');
    let html = '';
    if (styleMode === 'block') {
      html = `<div class="accordion-link-block" style="margin: 12px 0;"><a href="#${targetId}" class="accordion-jump-link">${cleanText}</a></div>`;
    } else {
      html = `<a href="#${targetId}" class="accordion-jump-link">${cleanText}</a>`;
    }

    setJustInserted(true);
    setTimeout(() => {
      onInsert(html);
    }, 200);
  };

  return (
    <div className="acc-link-picker-panel">
      <div className="acc-link-picker-header">
        <span className="acc-link-picker-title">
          🔗 {t('insertAccordionLink')}
        </span>
        <button type="button" className="acc-link-picker-close" onClick={onClose}>
          &times;
        </button>
      </div>

      <div className="acc-link-picker-body">
        <div className="acc-link-picker-row">
          <label className="acc-link-picker-label">{t('selectTargetAccordion')}:</label>
          <select
            className="acc-link-picker-select"
            value={targetId}
            onChange={(e) => handleSelectAcc(e.target.value)}
          >
            {availableSections.map((sec) => (
              <optgroup key={sec.sectionId} label={`📁 ${sec.sectionTitle}`}>
                {sec.accordions.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.title} (#{acc.id})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="acc-link-picker-row">
          <label className="acc-link-picker-label">{t('linkTextLabel')}</label>
          <input
            type="text"
            className="acc-link-picker-input"
            value={linkText}
            onInput={(e) => setLinkText(e.target.value)}
            placeholder="z. B. ➔ Zu den Projektbeispielen Organisation"
          />
        </div>

        <div className="acc-link-picker-row">
          <label className="acc-link-picker-label">Darstellung:</label>
          <div className="acc-link-picker-radios">
            <label>
              <input
                type="radio"
                name="accLinkStyle"
                checked={styleMode === 'inline'}
                onChange={() => handleStyleChange('inline')}
              />
              <span>{t('linkStyleInline')}</span>
            </label>
            <label>
              <input
                type="radio"
                name="accLinkStyle"
                checked={styleMode === 'arrow'}
                onChange={() => handleStyleChange('arrow')}
              />
              <span>{t('linkStyleArrow')}</span>
            </label>
            <label>
              <input
                type="radio"
                name="accLinkStyle"
                checked={styleMode === 'block'}
                onChange={() => handleStyleChange('block')}
              />
              <span>{t('linkStyleBlock')}</span>
            </label>
          </div>
        </div>

        <div className="acc-link-picker-footer">
          <button
            type="button"
            className="btn-acc-picker-confirm"
            disabled={!targetId}
            onClick={handleConfirm}
          >
            {justInserted ? `✓ ${t('linkInserted')}` : `✔ ${t('insertLinkBtn')}`}
          </button>
          <button type="button" className="btn-acc-picker-cancel" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    title: '',
    subtitle: '',
    content: '',
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
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [pendingUploads, setPendingUploads] = useState(0);
  const uploadBusy = pendingUploads > 0;
  const setUploadBusy = busy => setPendingUploads(count => Math.max(0, count + (busy ? 1 : -1)));
  const [copiedId, setCopiedId] = useState(null);
  const [activeLinkHelper, setActiveLinkHelper] = useState(null); // 'main' or `acc_${index}`
  const mainContentRef = useRef(null);
  const accContentRefs = useRef({});

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

      setForm({
        nav_label: activeEditSection.id === 'home' && activeEditSection.nav_label === activeEditSection.title ? 'Home' : (activeEditSection.nav_label || ''),
        title: activeEditSection.title || '',
        subtitle: activeEditSection.subtitle || '',
        content: activeEditSection.content || '',
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
      setActiveLinkHelper(null);
    }
  }, [activeEditSection]);

  const isLegalPage = activeEditSection?.id === 'impressum' || activeEditSection?.id === 'datenschutz';

  const handleCopyAnchor = (id) => {
    const text = `#${id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }).catch(() => fallbackCopy(text, id));
    } else {
      fallbackCopy(text, id);
    }
  };

  const fallbackCopy = (text, id) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy anchor ID:', err);
    }
  };

  const insertSnippet = (textarea, snippet, currentValue, setValue) => {
    if (textarea && typeof textarea.selectionStart === 'number') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = currentValue.substring(0, start);
      const after = currentValue.substring(end);
      const updated = before + snippet + after;
      setValue(updated);
      setTimeout(() => {
        textarea.focus();
        const nextPos = start + snippet.length;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 25);
    } else {
      const updated = currentValue ? (currentValue.trimEnd() + '\n' + snippet) : snippet;
      setValue(updated);
    }
  };

  const handleInsertLink = (targetField, snippet) => {
    if (targetField === 'main') {
      insertSnippet(mainContentRef.current, snippet, form.content, (val) => setForm((prev) => ({ ...prev, content: val })));
    } else if (targetField.startsWith('acc_')) {
      const index = parseInt(targetField.replace('acc_', ''), 10);
      const textarea = accContentRefs.current[index];
      const curContent = (form.accordions[index] && form.accordions[index].content) || '';
      insertSnippet(textarea, snippet, curContent, (val) => handleUpdateAccordion(index, 'content', val));
    }
    setActiveLinkHelper(null);
  };

  const getSelectedText = (targetField) => {
    let el = null;
    if (targetField === 'main') {
      el = mainContentRef.current;
    } else if (targetField.startsWith('acc_')) {
      const idx = parseInt(targetField.replace('acc_', ''), 10);
      el = accContentRefs.current[idx];
    }
    if (el && typeof el.selectionStart === 'number' && el.selectionStart !== el.selectionEnd) {
      return el.value.substring(el.selectionStart, el.selectionEnd);
    }
    return '';
  };

  const allSectionsList = (cmsSections && cmsSections.length > 0 ? cmsSections : sections) || [];
  const availableAccordionTargets = allSectionsList
    .map((sec) => {
      const accList = sec.id === activeEditSection?.id ? form.accordions : (sec.accordions || []);
      return {
        sectionId: sec.id,
        sectionTitle: sec.nav_label || sec.title || sec.id,
        accordions: (accList || []).filter((a) => a && a.id && a.title)
      };
    })
    .filter((sec) => sec.accordions.length > 0);

  const handleAddAccordion = () => {
    const num = (form.accordions?.length || 0) + 1;
    const newAcc = {
      id: `acc_${activeEditSection.id}_beispiel_${num}`,
      title: '',
      content: '',
      sort_order: num
    };
    setForm((prev) => ({
      ...prev,
      accordions: [...(prev.accordions || []), newAcc]
    }));
  };

  const handleUpdateAccordion = (index, field, value) => {
    setForm((prev) => {
      const updated = [...(prev.accordions || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, accordions: updated };
    });
  };

  const handleRemoveAccordion = (index) => {
    setForm((prev) => {
      const updated = [...(prev.accordions || [])];
      updated.splice(index, 1);
      return { ...prev, accordions: updated };
    });
  };

  const handleMoveAccordion = (index, direction) => {
    setForm((prev) => {
      const list = [...(prev.accordions || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      list.forEach((item, idx) => {
        item.sort_order = idx + 1;
      });
      return { ...prev, accordions: list };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (uploadBusy) return;
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
          title: form.title,
          subtitle: form.subtitle,
          content: form.content,
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
          title: form.title,
          subtitle: form.subtitle,
          content: form.content,
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
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => setActiveEditSection(null)}
            aria-label="Editor schließen"
          >
            &times;
          </button>
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

            {!isLegalPage && <SectionImageUpload key={activeEditSection.id+':image:'+language} layout={form.image_layout} onLayoutChange={image_layout=>setForm(prev=>({...prev,image_layout}))} value={form.image_url} onChange={image_url=>setForm(prev=>({...prev,image_url}))} csrfToken={csrfToken} onBusyChange={setUploadBusy} disabled={uploadBusy} />}

            {/* Hintergrund-Design: Farbe & Vollbreite Bild */}
            {!isLegalPage && (
              <div className="admin-bg-settings-card" style={{ background: '#fdfbfb', border: '1px solid #ebdada', borderRadius: '8px', padding: '16px 18px', margin: '20px 0' }}>
                <div style={{ marginBottom: '14px' }}>
                  <strong style={{ fontSize: '14.5px', color: 'var(--color-primary)', display: 'block', marginBottom: '3px' }}>
                    {t('sectionBgDesignTitle')}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {t('sectionBgDesignDesc')}
                  </span>
                </div>

                {/* 1. Hintergrundfarbe */}
                <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f0e4e5' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
                    <strong>{t('sectionBgColor')}:</strong>
                    {form.bg_color && (
                      <span
                        style={{
                          display: 'inline-block',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: form.bg_color,
                          border: '1px solid #999',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        title={form.bg_color}
                      />
                    )}
                  </label>

                  {/* Farb-Presets / Swatches */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {[
                      { label: 'Soft Blush (Standard)', value: '#f4e4e5', textCol: '#914c5e' },
                      { label: 'Weiß', value: '#ffffff', textCol: '#333333' },
                      { label: 'Zartes Rosé', value: '#fbf3f5', textCol: '#914c5e' },
                      { label: 'Warmes Creme', value: '#faf5f0', textCol: '#555555' },
                      { label: 'Beere Dunkel', value: '#914c5e', textCol: '#ffffff' }
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setForm({ ...form, bg_color: preset.value })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          border: form.bg_color === preset.value ? '2px solid var(--color-primary)' : '1px solid #dcdcdc',
                          backgroundColor: preset.value,
                          color: preset.textCol,
                          fontSize: '11.5px',
                          fontWeight: form.bg_color === preset.value ? 'bold' : 'normal',
                          cursor: 'pointer',
                          boxShadow: form.bg_color === preset.value ? '0 0 0 2px rgba(145, 76, 94, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        title={`${preset.label} (${preset.value})`}
                      >
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: preset.value,
                            border: '1px solid rgba(0,0,0,0.15)'
                          }}
                        />
                        {preset.label}
                      </button>
                    ))}
                    {form.bg_color && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, bg_color: '' })}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#888',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          textDecoration: 'underline'
                        }}
                        title="Auf Standard zurücksetzen"
                      >
                        ✕ Zurücksetzen
                      </button>
                    )}
                  </div>

                  {/* Freie Farbauswahl: Color Picker + Hex Input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <input
                      type="color"
                      value={form.bg_color && form.bg_color.startsWith('#') && form.bg_color.length === 7 ? form.bg_color : '#f4e4e5'}
                      onChange={(e) => setForm({ ...form, bg_color: e.target.value })}
                      style={{ width: '38px', height: '32px', padding: '1px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                      title="Farbe mit Pipette/Farbrad auswählen"
                    />
                    <input
                      type="text"
                      value={form.bg_color}
                      onInput={(e) => setForm({ ...form, bg_color: e.target.value })}
                      placeholder="#f4e4e5"
                      style={{ width: '110px', fontFamily: 'monospace', fontSize: '13px', padding: '6px 8px' }}
                    />
                    <span style={{ fontSize: '12px', color: '#666' }}>Eigener HEX-Farbcode</span>
                  </div>
                </div>

                <SectionImageUpload key={activeEditSection.id+':background:'+language} kind="background" value={form.bg_image_url} onChange={bg_image_url=>setForm(prev=>({...prev,bg_image_url}))} csrfToken={csrfToken} onBusyChange={setUploadBusy} disabled={uploadBusy} />
              </div>
            )}

            <SlideshowEditor key={activeEditSection.id + ':' + language} html={form.content} pageId={activeEditSection.id} csrfToken={csrfToken} onChange={content => setForm(prev => ({...prev,content}))} onBusyChange={setUploadBusy} />

            {/* Sektionstext */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}><strong>{t('sectionContent')}</strong></label>
                {!isLegalPage && (
                  <button
                    type="button"
                    className="btn-acc-link-trigger"
                    onClick={() => setActiveLinkHelper(activeLinkHelper === 'main' ? null : 'main')}
                  >
                    {t('insertAccordionLink')}
                  </button>
                )}
              </div>

              {activeLinkHelper === 'main' && (
                <AccordionLinkPicker
                  availableSections={availableAccordionTargets}
                  initialSelectedText={getSelectedText('main')}
                  onInsert={(snippet) => handleInsertLink('main', snippet)}
                  onClose={() => setActiveLinkHelper(null)}
                  t={t}
                />
              )}

              <RichTextEditor key={activeEditSection.id+':'+language} sourceRef={mainContentRef} value={form.content} onChange={content=>setForm(prev=>({...prev,content}))} />
            </div>

            {/* Kontaktdaten-Box Bearbeitung (nur für Sektion Kontakt) */}
            {activeEditSection.id === 'kontakt' && (
              <div className="admin-contact-box-section">
                <div className="admin-contact-box-header">
                  <strong className="admin-contact-box-title">
                    {t('contactBoxTitle')}
                  </strong>
                  <p className="admin-contact-box-desc">
                    {t('contactBoxDesc')}
                  </p>
                </div>

                <div className="admin-contact-grid">
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>🏢 {t('companyName')}</label>
                    <input
                      type="text"
                      value={form.contact_info?.company || ''}
                      onInput={(e) => setForm({
                        ...form,
                        contact_info: { ...(form.contact_info || {}), company: e.target.value }
                      })}
                      placeholder="z. B. Coaching-Praxis Sandra Freiberger"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>🏷️ {t('companyRole')}</label>
                    <input
                      type="text"
                      value={form.contact_info?.role || ''}
                      onInput={(e) => setForm({
                        ...form,
                        contact_info: { ...(form.contact_info || {}), role: e.target.value }
                      })}
                      placeholder="Systemische Beratung · Executive Coaching · Supervision"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: '1', minWidth: '220px', marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>✉️ {t('companyEmail')}</label>
                      <input
                        type="email"
                        value={form.contact_info?.email || ''}
                        onInput={(e) => setForm({
                          ...form,
                          contact_info: { ...(form.contact_info || {}), email: e.target.value }
                        })}
                        placeholder="name@example.com"
                      />
                    </div>

                    <div className="form-group" style={{ flex: '1', minWidth: '220px', marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>📞 {t('companyPhone')}</label>
                      <input
                        type="text"
                        value={form.contact_info?.phone || ''}
                        onInput={(e) => setForm({
                          ...form,
                          contact_info: { ...(form.contact_info || {}), phone: e.target.value }
                        })}
                        placeholder="Telefonnummer"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>🌐 {t('companyWeb')}</label>
                    <input
                      type="text"
                      value={form.contact_info?.web || ''}
                      onInput={(e) => setForm({
                        ...form,
                        contact_info: { ...(form.contact_info || {}), web: e.target.value }
                      })}
                      placeholder="https://example.com"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '0' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>💬 {t('companyNote')}</label>
                    <textarea
                      rows={2}
                      value={form.contact_info?.note || ''}
                      onInput={(e) => setForm({
                        ...form,
                        contact_info: { ...(form.contact_info || {}), note: e.target.value }
                      })}
                      placeholder="Wir freuen uns auf den Dialog mit Ihnen. Kontaktieren Sie uns gerne direkt per E-Mail oder telefonisch."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Aufklappbare Unterthemen (Akkordeons) für Praxisbeispiele */}
            {!isLegalPage && activeEditSection.id !== 'kontakt' && (
              <div className="admin-accordions-section">
                <div className="admin-accordions-header">
                  <div>
                    <label className="admin-acc-main-title">
                      <strong>{t('accordionsSectionTitle')}</strong>
                    </label>
                    <p className="admin-acc-hint">
                      {t('accordionsDescription')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-add-accordion"
                    onClick={handleAddAccordion}
                  >
                    {t('addAccordion')}
                  </button>
                </div>

                {(!form.accordions || form.accordions.length === 0) ? (
                  <div className="admin-acc-empty-card">
                    {t('noAccordions')}
                  </div>
                ) : (
                  <div className="admin-accordions-list">
                    {form.accordions.map((acc, index) => (
                      <div key={acc.id || index} className="admin-accordion-card">
                        <div className="admin-accordion-card-header">
                          <span className="admin-acc-card-badge">
                            #{index + 1}
                          </span>
                          <span className="admin-acc-card-title-preview">
                            {acc.title || '(Kein Titel)'}
                          </span>
                          <div className="admin-acc-card-actions">
                            <button
                              type="button"
                              className="admin-acc-action-btn"
                              disabled={index === 0}
                              onClick={() => handleMoveAccordion(index, -1)}
                              title="Nach oben"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className="admin-acc-action-btn"
                              disabled={index === form.accordions.length - 1}
                              onClick={() => handleMoveAccordion(index, 1)}
                              title="Nach unten"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              className="admin-acc-delete-btn"
                              onClick={() => handleRemoveAccordion(index)}
                              title={t('deleteAccordion')}
                            >
                              ✕ {t('deleteAccordion')}
                            </button>
                          </div>
                        </div>

                        <div className="admin-accordion-card-body">
                          {/* Anchor ID and copy button */}
                          <div className="admin-acc-id-row">
                            <div className="admin-acc-id-left">
                              <span className="admin-acc-id-label">{t('accordionAnchorId')}:</span>
                              <div className="admin-acc-id-input-box">
                                <span className="admin-acc-id-hash">#</span>
                                <input
                                  type="text"
                                  className="admin-acc-id-input"
                                  value={acc.id || ''}
                                  onInput={(e) => {
                                    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
                                    handleUpdateAccordion(index, 'id', clean);
                                  }}
                                  placeholder={`acc_${activeEditSection.id}_${index + 1}`}
                                  title="Eindeutige Sprungmarken-ID für Links (z. B. #acc_org_beispiele)"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn-acc-copy-id"
                              onClick={() => handleCopyAnchor(acc.id)}
                              title={t('copyAnchorId')}
                            >
                              {copiedId === acc.id ? `✓ ${t('copied')}` : t('copyAnchorId')}
                            </button>
                          </div>

                          <div className="form-group" style={{ marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px' }}>{t('accordionItemTitle')}</label>
                            <input
                              type="text"
                              value={acc.title}
                              onInput={(e) => handleUpdateAccordion(index, 'title', e.target.value)}
                              placeholder="z. B. Projektbeispiele Organisation"
                              required
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: '0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <label style={{ fontSize: '12px', margin: 0 }}>{t('accordionItemContent')}</label>
                              <button
                                type="button"
                                className="btn-acc-link-trigger"
                                onClick={() => setActiveLinkHelper(activeLinkHelper === `acc_${index}` ? null : `acc_${index}`)}
                              >
                                {t('insertAccordionLink')}
                              </button>
                            </div>

                            {activeLinkHelper === `acc_${index}` && (
                              <AccordionLinkPicker
                                availableSections={availableAccordionTargets}
                                initialSelectedText={getSelectedText(`acc_${index}`)}
                                onInsert={(snippet) => handleInsertLink(`acc_${index}`, snippet)}
                                onClose={() => setActiveLinkHelper(null)}
                                t={t}
                              />
                            )}

                            <RichTextEditor sourceRef={el=>{accContentRefs.current[index]=el;}} value={acc.content} onChange={content=>handleUpdateAccordion(index,'content',content)} label={'Unterthema '+(index+1)+' bearbeiten'} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
            <div className="cms-editor-preview-stage" style={{ backgroundColor: form.bg_color || undefined, backgroundImage: form.bg_image_url ? 'linear-gradient(rgba(255,255,255,.9),rgba(255,255,255,.9)),url('+JSON.stringify(form.bg_image_url)+')' : undefined, backgroundSize:'cover', backgroundPosition:'center' }}>
              <div className="cms-editor-preview-paper">
                <h4>{form.title || 'Überschrift'}</h4>
                {form.subtitle && <p className="cms-editor-preview-subtitle">{form.subtitle}</p>}
                <PageImageLayout src={form.image_url} alt="Seitenbild" mode={form.image_layout}>
                <div className="cms-editor-preview-copy"><WebsiteContent html={form.content} pageId={activeEditSection.id} /></div>
                {(form.accordions || []).length > 0 && (
                  <div className="cms-editor-preview-accordions">
                    {form.accordions.map((accordion, index) => <div key={accordion.id || index}>{accordion.title || 'Neues Thema'} <span aria-hidden="true">＋</span></div>)}
                  </div>
                )}
                </PageImageLayout>
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
              disabled={status.state === 'saving' || uploadBusy}
            >
              {status.state === 'saving' ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
