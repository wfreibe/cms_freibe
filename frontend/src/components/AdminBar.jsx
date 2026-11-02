import { useI18n } from '../context/I18nContext';

export function AdminBar({ onOpenCMS }) {
  const { isAuthenticated, logoutApi, isAdminMode, setIsAdminMode } = useI18n();

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logoutApi();
  };

  return (
    <div className="admin-editor-bar">
      <div className="container admin-bar-inner">
        <div className="admin-bar-status">
          <span className="admin-status-dot"></span>
          <strong>Redaktionsmodus aktiv</strong>
        </div>

        <div className="admin-bar-actions">
          <button
            type="button"
            className="admin-bar-btn"
            onClick={() => setIsAdminMode(!isAdminMode)}
          >
            {isAdminMode ? '✏ Bearbeiten ausblenden' : '✏ Bearbeiten einblenden'}
          </button>

          <button
            type="button"
            className="admin-bar-btn"
            onClick={onOpenCMS}
          >
            📋 Zum CMS-Dashboard
          </button>

          <button
            type="button"
            className="admin-bar-btn admin-bar-logout"
            onClick={handleLogout}
          >
            🔒 Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
