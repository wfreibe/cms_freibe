import { useState, useEffect } from 'preact/hooks';
import { sanitizeHtml } from '../utils/sanitizeHtml';

// Global click listener for in-page links targeting accordions
if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href*="#acc_"]');
    if (link) {
      const href = link.getAttribute('href');
      const hash = href.substring(href.indexOf('#') + 1);
      if (hash) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-accordion', { detail: { id: hash } }));
      }
    }
  });
}

export function AccordionItem({ accordion, isOpen, onToggle }) {
  const { id, title, content } = accordion;

  return (
    <div id={id} className={`accordion-item ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="accordion-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`acc-content-${id}`}
        id={`acc-header-${id}`}
      >
        <span className="accordion-title">{title}</span>
        <span className={`accordion-icon ${isOpen ? 'open' : ''}`} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      <div
        id={`acc-content-${id}`}
        role="region"
        aria-labelledby={`acc-header-${id}`}
        className={`accordion-collapse ${isOpen ? 'expanded' : 'collapsed'}`}
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        <div
          className="accordion-body"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
        />
      </div>
    </div>
  );
}

export function SectionAccordions({ accordions }) {
  if (!accordions || accordions.length === 0) return null;

  // Track open state for each accordion item by ID
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (id) => {
    setOpenItems((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const handleOpenAccordion = (e) => {
      const targetId = e.detail?.id;
      if (targetId && accordions.some((a) => a.id === targetId)) {
        // Open the target accordion item
        setOpenItems((prev) => ({
          ...prev,
          [targetId]: true
        }));

        // Smooth scroll and focus
        setTimeout(() => {
          const el = document.getElementById(targetId) || document.getElementById(`acc-header-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('accordion-highlight');
            setTimeout(() => el.classList.remove('accordion-highlight'), 1800);
            const btn = el.querySelector ? el.querySelector('button.accordion-header') : el;
            if (btn && btn.focus) btn.focus();
          }
        }, 60);
      }
    };

    window.addEventListener('open-accordion', handleOpenAccordion);
    return () => window.removeEventListener('open-accordion', handleOpenAccordion);
  }, [accordions]);

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && accordions.some((a) => a.id === hash)) {
        setOpenItems((prev) => ({
          ...prev,
          [hash]: true
        }));
        setTimeout(() => {
          const el = document.getElementById(hash) || document.getElementById(`acc-header-${hash}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [accordions]);

  return (
    <div className="section-accordions-wrapper">
      {accordions.map((acc) => (
        <AccordionItem
          key={acc.id}
          accordion={acc}
          isOpen={!!openItems[acc.id]}
          onToggle={() => toggleItem(acc.id)}
        />
      ))}
    </div>
  );
}
