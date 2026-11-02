/**
 * Client-Side Defense-in-Depth HTML Sanitizer for cms_sfreibe
 * 
 * Powered by DOMPurify.
 * Ensures that all HTML rendered via dangerouslySetInnerHTML is strictly disarmed
 * of scripts, event handlers, unsafe protocols, and nested vectors.
 */

import DOMPurify from 'dompurify';

// Configure DOMPurify hook to enforce rel="noopener noreferrer" on target="_blank"
if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    for (const attr of ['href', 'src']) {
      const value = node.getAttribute?.(attr);
      if (value && (/^[\s/\\]{2}/.test(value) || !/^(https?:|mailto:|tel:|#|\/(?![\/\\]))/i.test(value))) node.removeAttribute(attr);
    }
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 's',
    'ul', 'ol', 'li',
    'a', 'br', 'hr', 'blockquote',
    'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'small', 'code', 'pre', 'img'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'class', 'id', 'src', 'alt', 'width', 'height'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORCE_BODY: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM: false
};

/**
 * Sanitize untrusted or server-provided HTML string.
 * 
 * @param {string|null|undefined} rawHtml
 * @returns {string} Sanitized safe HTML string
 */
export function sanitizeHtml(rawHtml) {
  if (rawHtml === null || rawHtml === undefined) {
    return '';
  }

  if (typeof rawHtml !== 'string') {
    return '';
  }

  const trimmed = rawHtml.trim();
  if (trimmed === '') {
    return '';
  }

  try {
    return DOMPurify.sanitize(trimmed, DOMPURIFY_CONFIG);
  } catch (err) {
    console.error('[Security] Client-side DOMPurify error:', err);
    return '';
  }
}

export default sanitizeHtml;
