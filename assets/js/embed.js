/**
 * Book Library Embed & Instant Per-Request Link Generator
 * Automatically detects host domain from the script's own src URL.
 * Works seamlessly across ANY custom domain, subdomain, or localhost without hardcoding.
 *
 * Usage:
 *   <script src="https://YOUR-DOMAIN.com/assets/js/embed.js" data-api-key="sajimpk" defer></script>
 *
 * HTML Usage:
 *   <a data-book="cambridge-ielts-01">Download Cambridge IELTS 1</a>
 */
(function () {
  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="embed.js"], script[data-api-key], script[data-api-url]');

  let scriptOrigin = '';
  if (currentScript && currentScript.src) {
    try {
      scriptOrigin = new URL(currentScript.src, window.location.href).origin;
    } catch (_) {}
  }

  // Origin resolution:
  // By default, book reader URL resolves to the current website (window.location.origin -> e.g. https://example.com/book/)
  // It stays 100% on example.com and does NOT redirect to worker domain
  const siteUrl =
    (currentScript && (currentScript.dataset.siteUrl || currentScript.dataset.bookBaseUrl || currentScript.dataset.bookUrl)) ||
    window.BOOK_SITE_URL ||
    window.BOOK_BASE_URL ||
    window.location.origin;

  // apiUrl is the API service endpoint (e.g. worker domain)
  const apiUrl =
    (currentScript && currentScript.dataset.apiUrl) ||
    window.BOOK_API_URL ||
    scriptOrigin ||
    window.location.origin;

  const apiKey = (currentScript && currentScript.dataset.apiKey) || window.BOOK_API_KEY || '';

  const CIPHER_KEY = 0x5a;
  const EXPIRY_MS = 1500; // 1.5 seconds lifetime

  function generateInstantToken(id) {
    if (!id) return '';
    const ts = Date.now();
    const tsHex = ts.toString(36);
    const nonce = Math.floor(Math.random() * 0xFFFF).toString(36);
    const raw = id + '|' + nonce;
    const bytes = Array.from(new TextEncoder().encode(raw));
    const salt = (ts % 127);
    const xorBytes = bytes.map((b, i) => b ^ (CIPHER_KEY ^ ((salt + i * 7) & 0x7f)));
    let binary = '';
    for (let i = 0; i < xorBytes.length; i++) {
      binary += String.fromCharCode(xorBytes[i]);
    }
    const enc = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return tsHex + '.' + enc;
  }

  function getInstantBookUrl(id) {
    const token = generateInstantToken(id);
    const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
    return `${base}/book/?book=${token}`;
  }

  function bindBookLinks() {
    const bookElements = document.querySelectorAll('[data-book]');
    if (bookElements.length === 0) return;

    bookElements.forEach((el) => {
      const bookId = el.getAttribute('data-book');
      if (!bookId) return;

      // Set initial preview href
      el.setAttribute('href', getInstantBookUrl(bookId));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');

      // Refresh to fresh 0ms token on any mouse/touch interaction
      const refreshHref = () => {
        el.setAttribute('href', getInstantBookUrl(bookId));
      };
      el.addEventListener('pointerdown', refreshHref, { passive: true });
      el.addEventListener('mouseenter', refreshHref, { passive: true });
      el.addEventListener('focus', refreshHref, { passive: true });

      // Guarantee a fresh 0ms token on click
      el.addEventListener('click', () => {
        const freshUrl = getInstantBookUrl(bookId);
        el.setAttribute('href', freshUrl);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBookLinks);
  } else {
    bindBookLinks();
  }

  window.BookBridge = {
    sync: bindBookLinks,
    getApiUrl: () => apiUrl,
    generateUrl: getInstantBookUrl,
    generateToken: generateInstantToken,
    expiryMs: EXPIRY_MS
  };
})();
