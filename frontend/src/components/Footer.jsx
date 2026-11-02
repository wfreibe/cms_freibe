import { useState, useEffect } from 'preact/hooks';
import { useI18n } from '../context/I18nContext';

export function Footer() {
  const { t, openLegalModal } = useI18n();
  const currentYear = new Date().getFullYear();
  const [showFloating, setShowFloating] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowFloating(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLegalClick = (e, type) => {
    e.preventDefault();
    openLegalModal(type);
  };

  const scrollToTop = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    history.replaceState(null, '', '/');
  };

  return (
    <>
      <footer className="site-footer" id="footer">
        <div className="container footer-container">
          <ul className="footer-links-left">
            <li>
              <a href="/impressum" onClick={(e) => handleLegalClick(e, 'impressum')}>
                {t('impressum')}
              </a>
            </li>
            <li>
              <a href="/datenschutz" onClick={(e) => handleLegalClick(e, 'datenschutz')}>
                {t('datenschutz')}
              </a>
            </li>
          </ul>

          {/* Button am Ende der Seite für Navigation nach ganz oben */}
          <div className="footer-center">
            <button
              type="button"
              className="btn-back-to-top"
              onClick={scrollToTop}
              title={t('backToTop')}
              aria-label={t('backToTop')}
            >
              <span className="back-to-top-icon" aria-hidden="true">▲</span>
              <span>{t('backToTop')}</span>
            </button>
          </div>

          <div className="footer-copyright-right">
            &copy; {currentYear} Sandra Freiberger
          </div>
        </div>
      </footer>

      {/* Dezenter Floating-Button bei längerem Scrollen */}
      {showFloating && (
        <button
          type="button"
          className="floating-back-to-top"
          onClick={scrollToTop}
          title={t('backToTop')}
          aria-label={t('backToTop')}
        >
          ▲
        </button>
      )}
    </>
  );
}
