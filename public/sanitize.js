// ==========================================
// HTML Sanitization Utility
// Prevents XSS attacks by escaping HTML entities
// ==========================================

/**
 * Escape HTML entities to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') str = String(str);

  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return str.replace(/[&<>"'`=\/]/g, function(char) {
    return htmlEntities[char];
  });
}

/**
 * Sanitize an object's string properties recursively
 * @param {object} obj - The object to sanitize
 * @returns {object} - The sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return escapeHtml(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

/**
 * Safely format currency values
 * @param {number} amount - The amount to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  return '$' + Number(amount).toLocaleString();
}

/**
 * Safely format dates
 * @param {string|Date} dateStr - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch (e) {
    return 'N/A';
  }
}

/**
 * Validate and sanitize URL
 * @param {string} url - The URL to validate
 * @returns {string} - Safe URL or empty string
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';

  // Only allow relative URLs or https URLs
  if (url.startsWith('/') || url.startsWith('./')) {
    return encodeURI(url);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch (e) {
    // Invalid URL
  }

  return '';
}

/**
 * Create a text node safely (alternative to innerHTML for plain text)
 * @param {string} text - The text content
 * @returns {Text} - A text node
 */
function createTextNode(text) {
  return document.createTextNode(text || '');
}

/**
 * Set text content safely
 * @param {Element} element - The DOM element
 * @param {string} text - The text to set
 */
function setTextContent(element, text) {
  if (element) {
    element.textContent = text || '';
  }
}
