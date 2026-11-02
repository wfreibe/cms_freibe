import { useI18n } from '../context/I18nContext';
import { ContactForm } from './ContactForm';
import { SectionAccordions } from './Accordion';
import { sanitizeHtml } from '../utils/sanitizeHtml';

export function Section({ section, index }) {
  const { isAdminMode, setActiveEditSection, t, isAuthenticated } = useI18n();

  const sectionStyle = {};
  if (section.bg_color) {
    sectionStyle.backgroundColor = section.bg_color;
  }
  if (section.bg_image_url) {
    sectionStyle.backgroundImage = `url("${section.bg_image_url}")`;
  }

  return (
    <section
      id={section.id}
      className={`content-section ${section.bg_image_url ? 'has-bg-image' : ''}`}
      style={sectionStyle}
    >
      {section.bg_image_url && (
        <div className="section-bg-overlay" aria-hidden="true" />
      )}
      <div className="container stage-container">
        {/* Hauptspalte mit Inhalten ohne die alten Bälle */}
        <div className="stage-center-col">
          <div className="section-header-wrap">
            <h1 className="section-title">{section.title}</h1>

            {isAuthenticated && isAdminMode && (
              <button
                type="button"
                className="edit-section-btn"
                onClick={() => setActiveEditSection(section)}
                title={t('editSection')}
              >
                ✏ {t('editSection')}
              </button>
            )}
          </div>

          {section.subtitle && (
            <p className="section-subtitle">{section.subtitle}</p>
          )}

          {/* 16:9 Sektionsbild vor dem Text (falls hinterlegt) */}
          {section.image_url && (
            <div className="section-featured-image-wrap">
              <img
                src={section.image_url}
                alt={section.title || section.nav_label}
                className="section-featured-image"
                loading="lazy"
              />
            </div>
          )}

          <div
            className="section-body"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content) }}
          />

          {/* Aufklappbare Akkordeons für Praxisbeispiele & Unterthemen */}
          {section.accordions && section.accordions.length > 0 && (
            <SectionAccordions accordions={section.accordions} />
          )}

          {section.id === 'kontakt' && <ContactForm contactInfo={section.contact_info} />}
        </div>
      </div>
    </section>
  );
}
