import { FR_TRANSLATIONS } from './fr';
import { createContext } from 'preact';
import { useState, useEffect, useContext } from 'preact/hooks';

// Default static translations for UI chrome
export const UI_TRANSLATIONS = {
  fr: FR_TRANSLATIONS,
  de: {
    retry: 'Erneut laden', pageUnavailable: 'Seite nicht verfügbar.', loadFailed: 'Inhalte konnten nicht geladen werden.', toggleMenu: 'Menü öffnen/schließen',
    navSkip: 'Navigation überspringen',
    adminMode: 'CMS Bearbeiten',
    adminExit: 'CMS Beenden',
    editSection: 'Sektion bearbeiten',
    saving: 'Speichern...',
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schließen',
    email: 'Ihre E-Mail',
    phone: 'Telefonnummer',
    send: 'Nachricht absenden',
    sending: 'Wird gesendet...',
    impressum: 'Impressum',
    datenschutz: 'Datenschutz',
    allRightsReserved: 'Alle Rechte vorbehalten.',
    loading: 'Inhalte werden geladen...',
    adminTitle: 'Inhalte & Menü im Headless CMS bearbeiten',
    adminAuthHint: 'Geben Sie das Admin-Passwort ein:',
    adminPassword: 'Passwort',
    login: 'Anmelden',
    logout: 'Abmelden',
    navLabel: 'Name des Menüpunkts (Navigation)',
    sectionTitle: 'Titel / Überschrift',
    sectionSubtitle: 'Untertitel',
    sectionContent: 'Inhalt (Text / HTML)',
    sectionImage: '16:9 Bild-URL (z. B. https://... oder /files/bild.jpg)',
    sectionBgColor: 'Hintergrundfarbe dieser Sektion',
    sectionBgImage: 'Hintergrundbild (vollflächig & responsiv)',
    sectionBgDesignTitle: '🎨 Hintergrund-Design (Farbe & Bild)',
    sectionBgDesignDesc: 'Wählen Sie eine Hintergrundfarbe für diesen Bereich oder hinterlegen Sie ein vollflächiges responsives Hintergrundbild.',
    isActiveLabel: 'Menüpunkt auf der Website anzeigen (Aktiv)',
    sortOrderLabel: 'Reihenfolge (Sortierung)',
    updateSuccess: 'Sektion erfolgreich aktualisiert!',
    addSection: 'Neuen Menüpunkt hinzufügen',
    deleteSection: 'Löschen',
    deleteConfirm: 'Möchten Sie diesen Menüpunkt wirklich unwiderruflich löschen?',
    backToTop: 'Nach oben',
    accordionsSectionTitle: 'Aufklappbare Unterthemen (Akkordeons)',
    accordionsDescription: 'Hier können Sie Praxisbeispiele oder Themenschwerpunkte als aufklappbare Elemente unterhalb des Haupttextes verwalten.',
    accordionItemTitle: 'Titel des Themas / Akkordeons',
    accordionItemContent: 'Inhalt des Themas (HTML/Text)',
    addAccordion: '➕ Neues Akkordeon hinzufügen',
    deleteAccordion: 'Löschen',
    noAccordions: 'Noch keine aufklappbaren Unterthemen vorhanden.',
    insertAccordionLink: '🔗 Akkordeon-Sprunglink einfügen',
    selectTargetAccordion: 'Ziel-Akkordeon auswählen',
    linkTextLabel: 'Link-Text:',
    insertLinkBtn: 'In Text einfügen',
    accordionAnchorId: 'Sprungmarken-ID',
    copyAnchorId: '📋 ID kopieren',
    copied: 'Kopiert!',
    linkInserted: 'Eingefügt!',
    linkStyleInline: 'Im Text',
    linkStyleArrow: 'Mit Pfeil ➔',
    linkStyleBlock: 'Eigener Block',
    contactBoxTitle: '📇 Kontaktdaten-Box bearbeiten',
    contactBoxDesc: 'Diese Daten werden in der Informationskarte auf der Website angezeigt.',
    companyName: 'Name / Inhaberin',
    companyRole: 'Tätigkeitsbereich / Untertitel',
    companyEmail: 'E-Mail-Adresse',
    companyPhone: 'Telefonnummer',
    companyWeb: 'Web / Website-Adresse',
    companyNote: 'Hinweistext (Abschluss)'
  },
  en: {
    retry: 'Retry', pageUnavailable: 'Page unavailable.', loadFailed: 'Could not load content.', toggleMenu: 'Open/close menu',
    navSkip: 'Skip navigation',
    adminMode: 'CMS Edit',
    adminExit: 'Exit CMS',
    editSection: 'Edit Section',
    saving: 'Saving...',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    email: 'Your Email',
    phone: 'Phone Number',
    send: 'Send Message',
    sending: 'Sending...',
    impressum: 'Imprint',
    datenschutz: 'Privacy Policy',
    allRightsReserved: 'All rights reserved.',
    loading: 'Loading content...',
    adminTitle: 'Edit content & navigation in Headless CMS',
    adminAuthHint: 'Enter admin password:',
    adminPassword: 'Password',
    login: 'Login',
    logout: 'Logout',
    navLabel: 'Navigation Label (Menu Name)',
    sectionTitle: 'Title / Heading',
    sectionSubtitle: 'Subtitle',
    sectionContent: 'Content (Text / HTML)',
    sectionImage: '16:9 Image URL (e.g. https://... or /files/image.jpg)',
    sectionBgColor: 'Background Color for this Section',
    sectionBgImage: 'Background Image (Full-width & responsive)',
    sectionBgDesignTitle: '🎨 Background Design (Color & Image)',
    sectionBgDesignDesc: 'Set a custom background color or a full-width responsive background photo for this section.',
    isActiveLabel: 'Show menu item on website (Active)',
    sortOrderLabel: 'Sort Order',
    updateSuccess: 'Section updated successfully!',
    addSection: 'Add New Menu Item',
    deleteSection: 'Delete',
    deleteConfirm: 'Are you sure you want to permanently delete this menu item?',
    backToTop: 'Back to top',
    accordionsSectionTitle: 'Expandable Subtopics (Accordions)',
    accordionsDescription: 'Manage focus areas or subpages as expandable elements below the main text.',
    accordionItemTitle: 'Topic / Accordion Title',
    accordionItemContent: 'Topic Content (HTML/Text)',
    addAccordion: '➕ Add new accordion',
    deleteAccordion: 'Delete',
    noAccordions: 'No expandable subtopics added yet.',
    insertAccordionLink: '🔗 Insert Accordion Jump Link',
    selectTargetAccordion: 'Select target accordion',
    linkTextLabel: 'Link Text:',
    insertLinkBtn: 'Insert into text',
    accordionAnchorId: 'Anchor ID',
    copyAnchorId: '📋 Copy ID',
    copied: 'Copied!',
    linkInserted: 'Inserted!',
    linkStyleInline: 'Inline text',
    linkStyleArrow: 'With arrow ➔',
    linkStyleBlock: 'Block paragraph',
    contactBoxTitle: '📇 Edit Contact Information Box',
    contactBoxDesc: 'This information is displayed in the information card on the website.',
    companyName: 'Name / Owner',
    companyRole: 'Service Area / Subtitle',
    companyEmail: 'Email Address',
    companyPhone: 'Phone Number',
    companyWeb: 'Web / Website Address',
    companyNote: 'Closing Note'
  }
};

const I18nContext = createContext(null);

export function I18nProvider({ children, cms = false }) {
  const [language, setLangState] = useState('de');

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  const [sections, setSections] = useState([]);
  const [cmsSections, setCmsSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState(null);
  const [legalModalData, setLegalModalData] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');

  // Backward compatibility alias for components checking truthiness
  const adminToken = isAuthenticated ? 'authenticated' : '';
  const setAdminToken = (val) => setIsAuthenticated(!!val);

  // Check existing session status on load and retrieve CSRF token
  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setPasswordChangeRequired(!!data.authenticated && !!data.passwordChangeRequired);
        setIsAuthenticated(!!data.authenticated && !data.passwordChangeRequired);
        if (data.csrf_token) {
          setCsrfToken(data.csrf_token);
        }
        if (data.authenticated && !data.passwordChangeRequired) {
          await fetchCmsSections(language);
        }
      }
    } catch (err) {
      console.warn('Session check failed:', err.message);
    }
  };

  // Open live legal modal (Strictly via dedicated /api/legal/{type} endpoint)
  const openLegalModal = async (type) => {
    setLegalModalData(null);
    try {
      const res = await fetch(`/api/legal/${encodeURIComponent(type)}?lang=${language}`, { credentials: 'same-origin' });
      if (res.ok) { setLegalModalData(await res.json()); return; }
      if (res.status === 404) {
        setLegalModalData({ id: type, title: t(type), error: language === 'fr' ? 'Ce texte juridique n’est pas publié.' : language === 'en' ? 'This legal text is not published.' : 'Dieser Rechtstext ist nicht veröffentlicht.' });
        return;
      }
      throw new Error('API error');
    } catch {
      setLegalModalData({ id: type, title: t(type), retry: true, error: language === 'fr' ? 'Impossible de charger ce texte. Veuillez réessayer.' : language === 'en' ? 'Could not load this text. Please try again.' : 'Der Text konnte nicht geladen werden. Bitte erneut versuchen.' });
    }
  };

  // Switch language and persist
  const setLanguage = (lang) => {
    if (!['de', 'en', 'fr'].includes(lang)) return;
    setSections([]);
    setCmsSections([]);
    setLegalModalData(null);
    setLangState(lang);
  };

  // Helper for static text lookup
  const t = (key) => {
    const dict = UI_TRANSLATIONS[language] || UI_TRANSLATIONS.de;
    return dict[key] || key;
  };

  // 1. Fetch public (active) sections
  const fetchSections = async (lang = language) => {
    setLoading(true);
    setSections([]);
    setApiError(false);
    try {
      const res = await fetch(`/api/sections?lang=${lang}`, { credentials: 'omit' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSections(data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Content request failed.', err.message);
    }
    setSections([]);
    setApiError(true);
    setLoading(false);
  };

  // 2. Fetch all sections for CMS dashboard (active & inactive, strictly requires session)
  const fetchCmsSections = async (lang = language) => {
    try {
      const res = await fetch(`/api/sections?lang=${lang}&all=true`, {
        credentials: 'same-origin'
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        setPasswordChangeRequired(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCmsSections(data);
          return;
        }
      }
    } catch (err) {
      console.warn('CMS request failed:', err.message);
    }
    setCmsSections([]);
    setApiError(true);
  };

  useEffect(() => {
    fetchSections(language);
    if (cms) checkSession();
  }, [language]);

  // Login action
  const loginApi = async (username, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success) {
        const restricted = !!data.passwordChangeRequired;
        setPasswordChangeRequired(restricted);
        setIsAuthenticated(!restricted);
        if (data.csrf_token) {
          setCsrfToken(data.csrf_token);
        }
        if (!restricted) {
          await fetchCmsSections(language);
          await fetchSections(language);
        }
        return { success: true, passwordChangeRequired: restricted };
      }
      return { success: false, error: (data && data.error) || 'Anmeldung fehlgeschlagen.' };
    } catch (err) {
      return { success: false, error: 'Verbindungsfehler zum Server.' };
    }
  };

  const changePasswordApi = async (newPassword, confirmPassword) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        credentials: 'same-origin',
        body: JSON.stringify({ newPassword, confirmPassword })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        if (res.status === 401) setPasswordChangeRequired(false);
        return { success: false, error: data?.error || 'Passwortänderung fehlgeschlagen.' };
      }
      setCsrfToken(data.csrf_token || '');
      setPasswordChangeRequired(false);
      setIsAuthenticated(true);
      await fetchCmsSections(language);
      await fetchSections(language);
      return { success: true };
    } catch {
      return { success: false, error: 'Verbindungsfehler zum Server.' };
    }
  };

  // Logout action
  const logoutApi = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin'
      });
    } catch (_) {}
    setIsAuthenticated(false);
    setPasswordChangeRequired(false);
    setCsrfToken('');
    setIsAdminMode(false);
  };

  // Update Section in Backend
  const updateSectionApi = async (id, payload) => {
    try {
      const res = await fetch(`/api/sections/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return { success: false, error: 'Sitzung abgelaufen. Bitte erneut anmelden.' };
      }
      if (res.ok) {
        await fetchSections(language);
        await fetchCmsSections(language);
        return { success: true, data };
      }
      return { success: false, error: (data && data.error) || `Fehler beim Speichern (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Toggle Section published status
  const toggleSectionActiveApi = async (id, isPublished) => {
    try {
      const res = await fetch(`/api/sections/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({ lang: language, is_published: isPublished ? 1 : 0, is_active: isPublished ? 1 : 0 })
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return { success: false, error: 'Sitzung abgelaufen. Bitte erneut anmelden.' };
      }
      if (res.ok) {
        await fetchSections(language);
        await fetchCmsSections(language);
        return { success: true };
      }
      return { success: false, error: (data && data.error) || `Fehler beim Umschalten (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Toggle Section navigation visibility
  const toggleSectionNavApi = async (id, showInNav) => {
    try {
      const res = await fetch(`/api/sections/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({ lang: language, show_in_navigation: showInNav ? 1 : 0 })
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return { success: false, error: 'Sitzung abgelaufen. Bitte erneut anmelden.' };
      }
      if (res.ok) {
        await fetchSections(language);
        await fetchCmsSections(language);
        return { success: true };
      }
      return { success: false, error: (data && data.error) || `Fehler beim Umschalten (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Delete Section
  const deleteSectionApi = async (id) => {
    try {
      const res = await fetch(`/api/sections/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin'
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return { success: false, error: 'Sitzung abgelaufen. Bitte erneut anmelden.' };
      }
      if (res.ok) {
        await fetchSections(language);
        await fetchCmsSections(language);
        return { success: true };
      }
      return { success: false, error: (data && data.error) || `Fehler beim Löschen (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Create Section
  const createSectionApi = async (sectionData) => {
    try {
      const res = await fetch('/api/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        credentials: 'same-origin',
        body: JSON.stringify({ ...sectionData, lang: language })
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return { success: false, error: 'Sitzung abgelaufen. Bitte erneut anmelden.' };
      }
      if (res.ok) {
        await fetchSections(language);
        await fetchCmsSections(language);
        return { success: true, data };
      }
      return { success: false, error: (data && data.error) || `Fehler beim Erstellen (HTTP ${res.status})` };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Optimistic local section update
  const updateSectionLocal = (updatedData) => {
    setSections((prev) =>
      prev.map((s) => (s.id === updatedData.id ? { ...s, ...updatedData } : s))
    );
    setCmsSections((prev) =>
      prev.map((s) => (s.id === updatedData.id ? { ...s, ...updatedData } : s))
    );
  };

  const value = {
    language,
    setLanguage,
    t,
    sections,
    cmsSections,
    loading,
    apiError,
    fetchSections,
    fetchCmsSections,
    isAdminMode,
    setIsAdminMode,
    activeEditSection,
    setActiveEditSection,
    legalModalData,
    setLegalModalData,
    openLegalModal,
    isAuthenticated,
    passwordChangeRequired,
    setIsAuthenticated,
    csrfToken,
    setCsrfToken,
    checkSession,
    loginApi,
    changePasswordApi,
    logoutApi,
    adminToken,
    setAdminToken,
    updateSectionLocal,
    updateSectionApi,
    toggleSectionActiveApi,
    toggleSectionNavApi,
    deleteSectionApi,
    createSectionApi
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
