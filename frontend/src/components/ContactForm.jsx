import { useI18n } from '../context/I18nContext';

export function ContactForm({ contactInfo }) {
  const { language } = useI18n();

  const isFr = language === 'fr';
  const isEn = language === 'en';

  if (!contactInfo || typeof contactInfo !== 'object') return null;
  const info = contactInfo;
  const cleanPhone = (info.phone || '').replace(/[^0-9+]/g, '');
  const webUrl = /^https:\/\/[^\s]+$/i.test(info.web || '') ? info.web : null;

  return (
    <div className="contact-card-container">
      <div className="contact-details-box">
        <div className="contact-company-header">
          <h3>{info.company}</h3>
          {info.role && <p className="contact-role">{info.role}</p>}
        </div>

        <div className="contact-methods-grid">
          {/* E-Mail Adresse (Prominent) */}
          {info.email && (
            <div className="contact-method-item">
              <span className="contact-method-label">{isFr ? 'E-mail :' : isEn ? 'Email:' : 'E-Mail:'}</span>
              <a
                href={`mailto:${info.email}`}
                className="contact-direct-link contact-email"
                title={isFr ? 'Envoyer un e-mail' : isEn ? 'Send an email' : 'E-Mail schreiben'}
              >
                {info.email}
              </a>
            </div>
          )}

          {/* Telefon */}
          {info.phone && (
            <div className="contact-method-item">
              <span className="contact-method-label">{isFr ? 'Téléphone :' : isEn ? 'Phone:' : 'Telefon:'}</span>
              <a
                href={`tel:${cleanPhone}`}
                className="contact-direct-link"
                title={isFr ? 'Appeler' : isEn ? 'Call us' : 'Anrufen'}
              >
                {info.phone}
              </a>
            </div>
          )}

          {/* Web */}
          {webUrl && (
            <div className="contact-method-item">
              <span className="contact-method-label">Web:</span>
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-direct-link"
              >
                {info.web}
              </a>
            </div>
          )}
        </div>

        {info.note && (
          <div className="contact-note">
            <p>{info.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
