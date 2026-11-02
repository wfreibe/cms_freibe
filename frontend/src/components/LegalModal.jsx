import { useI18n } from '../context/I18nContext';
import { sanitizeHtml } from '../utils/sanitizeHtml';

export function LegalModal() {
  const {
    legalModalData,
    setLegalModalData,
    isAuthenticated,
    setActiveEditSection,
    t,
    openLegalModal
  } = useI18n();

  if (!legalModalData) return null;

  const closeModal = () => {
    setLegalModalData(null);
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (['impressum', 'datenschutz'].includes(path)) {
      history.replaceState(null, '', '/');
    }
  };

  const handleEditClick = () => {
    const toEdit = legalModalData;
    closeModal();
    setActiveEditSection(toEdit);
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div
        className="modal-content legal-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px' }}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '28px', color: 'var(--color-primary)', fontFamily: 'var(--font-family-heading)', letterSpacing: '1px', margin: 0 }}>
              {legalModalData.title}
            </h2>
            {legalModalData.subtitle && (
              <p style={{ fontSize: '12.5px', color: '#666', marginTop: '4px', margin: 0 }}>
                {legalModalData.subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={closeModal}
            aria-label="Schließen"
          >
            &times;
          </button>
        </div>

        {legalModalData.error && <div role="alert" className="modal-body">
          <p>{legalModalData.error}</p>
          {legalModalData.retry && <button onClick={() => openLegalModal(legalModalData.id)}>{t('retry')}</button>}
        </div>}
        <div
          className="modal-body legal-modal-body"
          style={{ padding: '24px 28px', lineHeight: '1.6', fontSize: '14px', color: '#222' }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(legalModalData.content) }}
        />

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {isAuthenticated && !legalModalData.error && (
              <button
                type="button"
                className="btn-submit"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleEditClick}
              >
                ✏ Diesen Text im CMS bearbeiten
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={closeModal}
          >
            {t('close') || 'Schließen'}
          </button>
        </div>
      </div>
    </div>
  );
}
