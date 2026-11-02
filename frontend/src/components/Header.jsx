import { useI18n } from '../context/I18nContext';
import { useState } from 'preact/hooks';
import { Navigation } from './Navigation';
import { LanguageSwitch } from './LanguageSwitch';

export function Header({ activeId, onNavigate }) {
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="site-header" id="top">
      <div className="container header-container">
        {/* Top utility row: Language switch only on Desktop, or integrated on Mobile */}
        <div className="header-meta-row">
          <div className="header-meta-right">
            <LanguageSwitch />
          </div>
        </div>

        {/* Main row: Navigation on Left, Logo on Right */}
        <div className="header-main-row">
          {/* Mobile bar items */}
          <div className="header-mobile-bar">
            <a
              href="/"
              onClick={(e) => {
                onNavigate('home', e);
                setMobileMenuOpen(false);
              }}
              title="Sandra Freiberger"
              className="mobile-logo-link"
            >
              <img
                src="/logo_sandra_freiberger.png"
                alt="Sandra Freiberger"
                className="header-logo-img"
              />
            </a>

            <div className="mobile-actions">
              <LanguageSwitch />
              <button
                type="button"
                className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={t('toggleMenu')}
                aria-expanded={mobileMenuOpen}
              >
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
              </button>
            </div>
          </div>

          {/* Desktop & Mobile Navigation container */}
          <div className={`header-nav-area ${mobileMenuOpen ? 'nav-open' : ''}`}>
            <Navigation
              activeId={activeId}
              onNavigate={(id, e) => {
                setMobileMenuOpen(false);
                onNavigate(id, e);
              }}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>

          {/* Desktop Logo */}
          <div className="header-logo-area desktop-only">
            <a href="/" onClick={(e) => onNavigate('home', e)} title="Sandra Freiberger">
              <img
                src="/logo_sandra_freiberger.png"
                alt="Sandra Freiberger"
                className="header-logo-img"
              />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
