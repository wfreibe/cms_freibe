import { useI18n } from '../context/I18nContext';

export function LanguageSwitch() {
  const { language, setLanguage } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label="Deutsch / English / Français">
      {[['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français']].map(([code, label]) => (
        <button key={code} type="button" className="lang-link-btn"
          lang={code} aria-label={label} aria-pressed={language === code}
          onClick={() => setLanguage(code)} title={label}>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
