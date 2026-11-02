import { useI18n } from '../context/I18nContext';

export function Navigation({ activeId, onNavigate, onClose }) {
  const { sections } = useI18n();

  const handleClick = (id, e) => {
    onNavigate(id, e);
    if (onClose) onClose();
  };

  const navSections = sections.filter((sec) => {
    // Standalone legal pages are accessed via footer modal only
    if (['impressum', 'datenschutz'].includes(sec.id)) {
      return false;
    }
    // Check show_in_navigation flag if present
    if (sec.show_in_navigation !== undefined && Number(sec.show_in_navigation) === 0) {
      return false;
    }
    // Check is_published / is_active flag
    if (sec.is_published !== undefined && Number(sec.is_published) === 0) {
      return false;
    }
    if (sec.is_active !== undefined && Number(sec.is_active) === 0) {
      return false;
    }
    return true;
  });

  return (
    <nav className="main-nav" aria-label="Main Navigation">
      <ul className="nav-list">
        {navSections.map((sec) => {
          const isActive = activeId === sec.id;
          return (
            <li key={sec.id} className="nav-item">
              <a
                href={`/${sec.id === 'home' ? '' : sec.id}`}
                className={isActive ? 'active' : ''}
                onClick={(e) => handleClick(sec.id, e)}
                aria-current={isActive ? 'true' : undefined}
              >
                {sec.nav_label || sec.title}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
