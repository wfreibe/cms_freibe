import { useState, useEffect } from 'preact/hooks';

export function useScrollSpy(sectionIds, offset = 100) {
  const [activeId, setActiveId] = useState(sectionIds[0] || 'home');

  useEffect(() => {
    if (!sectionIds || sectionIds.length === 0) return;

    const visibleEntries = new Map();

    const handleIntersection = (entries) => {
      entries.forEach(entry => {
        visibleEntries.set(entry.target.id, entry);
      });

      // Find visible section closest to the top offset
      let bestId = null;
      let minDistance = Infinity;

      visibleEntries.forEach((entry, id) => {
        if (entry.isIntersecting) {
          const rect = entry.target.getBoundingClientRect();
          const distance = Math.abs(rect.top - offset);
          if (distance < minDistance) {
            minDistance = distance;
            bestId = id;
          }
        }
      });

      if (bestId) {
        setActiveId(bestId);
      }
    };

    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: `-${offset}px 0px -50% 0px`,
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0]
    });

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });

    // Fallback on scroll for top / bottom edge cases
    const handleScroll = () => {
      if (window.scrollY < 60) {
        setActiveId(sectionIds[0] || 'home');
      } else if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        setActiveId(sectionIds[sectionIds.length - 1]);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sectionIds, offset]);

  // Smooth scroll handler with dynamic header offset calculation
  const scrollToSection = (id, e) => {
    if (e && e.preventDefault) e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    // Calculate actual sticky header height
    const headerMobileBar = document.querySelector('.header-mobile-bar');
    const siteHeader = document.querySelector('.site-header');
    const adminBar = document.querySelector('.admin-editor-bar');

    let baseHeaderHeight = 65;
    if (window.innerWidth <= 860 && headerMobileBar) {
      baseHeaderHeight = headerMobileBar.offsetHeight || 60;
    } else if (siteHeader) {
      baseHeaderHeight = siteHeader.offsetHeight || 75;
    }

    if (adminBar) {
      baseHeaderHeight += adminBar.offsetHeight || 0;
    }

    const extraBreathingSpace = 16; // Clear margin above H1 title
    const elementTop = el.getBoundingClientRect().top;
    const targetY = elementTop + window.pageYOffset - baseHeaderHeight - extraBreathingSpace;

    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth'
    });

    // Clean URL without '#' (e.g. /ueber-uns instead of /#ueber-uns)
    const cleanPath = id === 'home' ? '/' : `/${id}`;
    history.replaceState(null, '', cleanPath);
    setActiveId(id);
  };

  // On initial load, scroll to section if URL path or hash matches a section
  useEffect(() => {
    if (!sectionIds || sectionIds.length === 0) return;
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    const hash = window.location.hash.replace(/^#\/?/, '');
    const initialTarget = path || hash;
    if (initialTarget && initialTarget !== 'cms' && sectionIds.includes(initialTarget)) {
      setTimeout(() => {
        scrollToSection(initialTarget);
      }, 150);
    }
  }, [sectionIds]);

  return { activeId, scrollToSection };
}
