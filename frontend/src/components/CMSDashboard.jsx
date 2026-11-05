import {MenuParentField} from './MenuParentField';
import {BackgroundColorPicker} from './BackgroundColorPicker';
import {PageUrlField} from './PageUrlField';
import { useState } from 'preact/hooks';
import { useI18n } from '../context/I18nContext';
import { CMSWorkspace } from './CMSWorkspace';

export function CMSDashboard({ onBackToWebsite }) {
  const {
    isAuthenticated,
    passwordChangeRequired,
    setIsAdminMode,
    cmsSections,
    language,
    setLanguage,
    setActiveEditSection,
    toggleSectionActiveApi,
    toggleSectionNavApi,
    deleteSectionApi,
    createSectionApi,
    loginApi,
    changePasswordApi,
    logoutApi
  } = useI18n();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New section creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSection, setNewSection] = useState({
    id: '',
    nav_label: '',
    url_slug: '',
    menu_parent: '',
    title: '',
    subtitle: '',
    content: '',
    image_url: '',
    bg_color: '',
    bg_image_url: '',
    is_published: 0,
    show_in_navigation: 1
  });
  const [createStatus, setCreateStatus] = useState({ state: 'idle', message: '' });

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await loginApi(username, password);
    setPassword('');
    if (res.success) {
      if (!res.passwordChangeRequired) setIsAdminMode(true);
    } else {
      setErrorMsg(res.error || 'Anmeldung fehlgeschlagen.');
    }
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    await logoutApi();
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);
    const result = await changePasswordApi(newPassword, confirmPassword);
    setNewPassword('');
    setConfirmPassword('');
    if (result.success) setIsAdminMode(true);
    else setErrorMsg(result.error || 'Passwortänderung fehlgeschlagen.');
    setIsSubmitting(false);
  };

  const handleTogglePublished = async (sec) => {
    const isPub = sec.is_published !== undefined ? Boolean(sec.is_published) : (sec.is_active === 1 || sec.is_active === true);
    await toggleSectionActiveApi(sec.id, !isPub);
  };

  const handleToggleNav = async (sec) => {
    const inNav = sec.show_in_navigation !== undefined ? Boolean(sec.show_in_navigation) : true;
    await toggleSectionNavApi(sec.id, !inNav);
  };

  const handleDelete = async (sec) => {
    if (sec.id === 'home' || sec.id === 'kontakt') {
      alert('Die Sektionen "Home" und "Kontakt" können nicht gelöscht werden. Sie können sie jedoch deaktivieren.');
      return;
    }

    if (window.confirm(`Möchten Sie den Menüpunkt "${sec.nav_label}" (${sec.id}) wirklich löschen? Zugeordnete Unterseiten bleiben erhalten und werden ins Hauptmenü verschoben.`)) {
      const res = await deleteSectionApi(sec.id);
      if (!res.success) {
        alert(res.error || 'Fehler beim Löschen');
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newSection.id || !newSection.nav_label || !newSection.title) {
      setCreateStatus({ state: 'error', message: 'Bitte ID, Menüname und Titel ausfüllen.' });
      return;
    }

    setCreateStatus({ state: 'saving', message: 'Wird angelegt...' });
    const res = await createSectionApi(newSection);

    if (res.success) {
      setCreateStatus({ state: 'success', message: 'Sektion erfolgreich erstellt!' });
      setTimeout(() => {
        setIsCreateOpen(false);
        setNewSection({ id: '', nav_label: '', url_slug: '', menu_parent: '', title: '', subtitle: '', content: '', image_url: '', bg_color: '', bg_image_url: '' });
        setCreateStatus({ state: 'idle', message: '' });
      }, 700);
    } else {
      setCreateStatus({ state: 'error', message: res.error || 'Fehler beim Erstellen.' });
    }
  };

  if (passwordChangeRequired) {
    return (
      <div className="cms-login-page">
        <div className="cms-login-art">
          <span className="cms-login-art-label">FREIBERGER<span style="color:#c7254e">.</span><span style="color:#4AD7D1">DESIGN</span></span>
          <h1>Ein sicherer<br />Start für Ihre<br /><em>Website.</em></h1>
          <p>Bitte richten Sie jetzt Ihr dauerhaftes Passwort ein.</p>
        </div>
        <div className="cms-login-card">
          <div className="cms-login-logo"><strong>FREIBERGER<span style="color:#c7254e">.</span><span style="color:#4AD7D1">DESIGN</span></strong></div>
          <span className="cms-login-eyebrow">ERSTZUGANG</span>
          <h2 className="cms-login-title">Passwort ändern</h2>
          <p className="cms-login-subtitle">Das Einmalpasswort verliert danach seine Gültigkeit. Verwenden Sie mindestens 16 Zeichen mit Buchstaben und Ziffern.</p>
          {errorMsg && <div className="cms-login-error" role="alert">{errorMsg}</div>}
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label htmlFor="cms-new-pass">Neues Passwort</label>
              <input id="cms-new-pass" type="password" autoComplete="new-password" minLength="16" maxLength="72" required value={newPassword} onInput={(e) => setNewPassword(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="cms-confirm-pass">Neues Passwort bestätigen</label>
              <input id="cms-confirm-pass" type="password" autoComplete="new-password" minLength="16" maxLength="72" required value={confirmPassword} onInput={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" className="cms-workspace-button cms-workspace-button-primary cms-login-submit" disabled={isSubmitting}>{isSubmitting ? 'Wird gespeichert...' : 'Passwort speichern'}</button>
          </form>
          <button type="button" className="cms-workspace-button" onClick={handleLogout}>Abmelden</button>
        </div>
      </div>
    );
  }

  // 1. Nicht eingeloggt -> Login Maske
  if (!isAuthenticated) {
    return (
      <div className="cms-login-page">
        <div className="cms-login-art">
          <span className="cms-login-art-label">FREIBERGER<span style="color:#c7254e">.</span><span style="color:#4AD7D1">DESIGN</span></span>
          <h1>Architektur.<br /><em>Webdevelopment.</em></h1>
          <div className="cms-login-art-shapes" aria-hidden="true"><i /><i /><i /></div>
          <p>FREIBERGER.DESIGN · Inhalte verwalten</p>
        </div>
        <div className="cms-login-card">
          <div className="cms-login-logo">
            <strong>FREIBERGER<span style="color:#c7254e">.</span><span style="color:#4AD7D1">DESIGN</span></strong>
          </div>

          <span className="cms-login-eyebrow">REDAKTIONSBEREICH</span>
          <h2 className="cms-login-title">Schön, dass Sie da sind.</h2>
          <p className="cms-login-subtitle">
            Hier bearbeiten Sie die Inhalte Ihrer Website.
          </p>

          {errorMsg && (
            <div className="cms-login-error" role="alert">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="cms-user">Benutzername</label>
              <input
                type="text"
                id="cms-user"
                autoComplete="username"
                required
                value={username}
                onInput={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div className="form-group">
              <label htmlFor="cms-pass">Passwort</label>
              <input
                type="password"
                id="cms-pass"
                autoComplete="current-password"
                required
                value={password}
                onInput={(e) => setPassword(e.target.value)}
                placeholder="Passwort eingeben"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="cms-workspace-button cms-workspace-button-primary cms-login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Anmeldung läuft...' : 'Anmelden'} <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="cms-login-back">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onBackToWebsite();
              }}
            >
              &larr; Zurück zur öffentlichen Website
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. Eingeloggt -> CMS Workspace
  return (
    <div className="cms-dashboard-page">
      <CMSWorkspace
        sections={cmsSections}
        language={language}
        onLanguageChange={setLanguage}
        onEdit={setActiveEditSection}
        onCreate={() => setIsCreateOpen(true)}
        onTogglePublished={handleTogglePublished}
        onToggleNavigation={handleToggleNav}
        onDelete={handleDelete}
        onOpenWebsite={() => {
          setIsAdminMode(true);
          onBackToWebsite();
        }}
        onLogout={handleLogout}
      />

      {/* Modal zum Anlegen eines neuen Menüpunkts */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Neuen Menüpunkt &amp; Sektion anlegen</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {createStatus.state === 'error' && (
                  <div className="cms-login-error">{createStatus.message}</div>
                )}
                {createStatus.state === 'success' && (
                  <div className="alert-success">{createStatus.message}</div>
                )}

                <div className="form-group">
                  <label><strong>Menüpunkt-Name (Navigation) *</strong></label>
                  <input
                    type="text"
                    required
                    value={newSection.nav_label}
                    onInput={(e) => {
                      const val = e.target.value;
                      setNewSection({
                        ...newSection,
                        nav_label: val,
                        id: newSection.id || val.toLowerCase().replace(/[^a-z0-9]/g, '-')
                      });
                    }}
                    placeholder="z. B. Philosophie oder Workshops"
                  />
                </div>

                <MenuParentField value={newSection.menu_parent||''} onChange={menu_parent=>setNewSection(prev=>({...prev,menu_parent}))} pages={cmsSections}/>

                <PageUrlField value={newSection.url_slug||''} onChange={url_slug=>setNewSection(prev=>({...prev,url_slug}))} menuName={newSection.nav_label}/>

                <div className="form-group">
                  <label><strong>Technischer Anker-Link (ID) *</strong></label>
                  <input
                    type="text"
                    required
                    value={newSection.id}
                    onInput={(e) => setNewSection({ ...newSection, id: e.target.value })}
                    placeholder="Interne Kennung, unabhängig von der Seitenadresse"
                  />
                </div>

                <div className="form-group">
                  <label><strong>Sektionstitel (Überschrift) *</strong></label>
                  <input
                    type="text"
                    required
                    value={newSection.title}
                    onInput={(e) => setNewSection({ ...newSection, title: e.target.value })}
                    placeholder="z. B. Interaktive Workshops &amp; Formate"
                  />
                </div>

                <div className="form-group">
                  <label>Untertitel (optional)</label>
                  <input
                    type="text"
                    value={newSection.subtitle}
                    onInput={(e) => setNewSection({ ...newSection, subtitle: e.target.value })}
                    placeholder="z. B. Gemeinsam neue Lösungen erarbeiten"
                  />
                </div>

                <div className="form-group">
                  <label>16:9 Bild-URL (optional)</label>
                  <input
                    type="text"
                    value={newSection.image_url}
                    onInput={(e) => setNewSection({ ...newSection, image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/... oder /files/foto.jpg"
                  />
                </div>

                <BackgroundColorPicker value={newSection.bg_color} onChange={bg_color=>setNewSection(prev=>({...prev,bg_color}))}/>

                <div className="form-group">
                  <label>Vollflächiges Hintergrundbild-URL (optional)</label>
                  <input
                    type="text"
                    value={newSection.bg_image_url}
                    onInput={(e) => setNewSection({ ...newSection, bg_image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/... oder /files/bg.jpg"
                  />
                  <small style={{ fontSize: '11px', color: '#666', display: 'block', marginTop: '2px' }}>
                    Optionales responsives Hintergrundfoto für die gesamte Sektion.
                  </small>
                </div>

                <div className="form-group">
                  <label><strong>Inhalt (Text / HTML) *</strong></label>
                  <textarea
                    rows={5}
                    required
                    value={newSection.content}
                    onInput={(e) => setNewSection({ ...newSection, content: e.target.value })}
                    placeholder="<p>Hier den Text eingeben...</p>"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={createStatus.state === 'saving'}
                >
                  {createStatus.state === 'saving' ? 'Wird angelegt...' : 'Sektion anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
