/**
 * Book Library Embed & Dynamic Link Engine for Third-Party Websites
 * Enforces API Key Security: Without a valid API key, third-party sites cannot embed or resolve links.
 * 
 * Usage:
 *   <script src="https://YOUR_WORKER_DOMAIN/api/embed.js?key=YOUR_API_KEY" data-api-key="YOUR_API_KEY" defer></script>
 *
 * HTML Usage on any page:
 *   <a data-book="cambridge-ielts-19-academic">Read Cambridge IELTS 19</a>
 *
 * Book Viewer on yoursite.com/book/ page:
 *   <div id="book-reader-container"></div>
 *   <script src="https://YOUR_WORKER_DOMAIN/api/embed.js?key=YOUR_API_KEY" data-api-key="YOUR_API_KEY" defer></script>
 */
(function () {
  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="embed.js"], script[data-api-key], script[data-api-url]');

  let scriptOrigin = '';
  let scriptApiKey = '';

  if (currentScript && currentScript.src) {
    try {
      const scriptUrlObj = new URL(currentScript.src, window.location.href);
      scriptOrigin = scriptUrlObj.origin;
      scriptApiKey = scriptUrlObj.searchParams.get('key') || scriptUrlObj.searchParams.get('api_key') || '';
    } catch (_) {}
  }

  // Detect API Key (optional or provided)
  const apiKey =
    (currentScript && currentScript.dataset.apiKey) ||
    scriptApiKey ||
    window.BOOK_API_KEY ||
    '';

  // Base URL resolution:
  // 1. If explicit data-site-url is provided, use it.
  // 2. If API Key is present, use their own site domain (window.location.origin -> site.com/book/)
  // 3. If NO API Key is present, redirect to API Domain (scriptOrigin -> books.sajim-arifacademy.workers.dev/book/)
  const explicitSiteUrl =
    (currentScript && (currentScript.dataset.siteUrl || currentScript.dataset.bookBaseUrl || currentScript.dataset.bookUrl)) ||
    window.BOOK_SITE_URL ||
    window.BOOK_BASE_URL;

  const siteUrl = explicitSiteUrl
    ? explicitSiteUrl
    : (apiKey && apiKey.trim() !== ''
        ? window.location.origin
        : (scriptOrigin || window.location.origin));

  // apiUrl is the backend service endpoint
  const apiUrl =
    (currentScript && currentScript.dataset.apiUrl) ||
    window.BOOK_API_URL ||
    scriptOrigin ||
    window.location.origin;

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
    const base = siteUrl ? siteUrl.replace(/\/+$/, '') : '';
    return `${base}/book/?book=${token}`;
  }

  // Bind clickable elements
  function bindBookLinks() {
    const bookElements = document.querySelectorAll('[data-book]');
    if (bookElements.length === 0) return;

    bookElements.forEach((el) => {
      const bookId = el.getAttribute('data-book');
      if (!bookId) return;

      // Set initial preview href
      el.setAttribute('href', getInstantBookUrl(bookId));
      if (!el.hasAttribute('target')) {
        el.setAttribute('target', '_blank');
      }
      el.setAttribute('rel', 'noopener noreferrer');

      // Refresh to fresh 0ms token on any mouse/touch interaction
      const refreshHref = () => {
        el.setAttribute('href', getInstantBookUrl(bookId));
      };
      el.addEventListener('pointerdown', refreshHref, { passive: true });
      el.addEventListener('mouseenter', refreshHref, { passive: true });
      el.addEventListener('focus', refreshHref, { passive: true });

      // Guarantee a fresh 0ms token on click
      el.addEventListener('click', (e) => {
        const freshUrl = getInstantBookUrl(bookId);
        el.setAttribute('href', freshUrl);
      });
    });
  }

  // Fetch single book details from secure API
  async function fetchBookDetails(bookOrToken) {
    try {
      const endpoint = `${apiUrl.replace(/\/+$/, '')}/api/book-info?book=${encodeURIComponent(bookOrToken)}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('[BookLibrary] Failed to fetch book info:', err);
      return null;
    }
  }

  // Auto-Reader: If placed inside a /book/ page or container #book-reader-container
  async function autoInitReader() {
    const container = document.getElementById('book-reader-container');
    const isBookPath = window.location.pathname.includes('/book') || window.location.search.includes('book=') || window.location.search.includes('id=');
    
    if (!container && !isBookPath) return;

    const targetElement = container || document.getElementById('bookDetail');
    if (!targetElement) return;

    const searchParams = new URLSearchParams(window.location.search);
    const bookToken = searchParams.get('book') || searchParams.get('id') || searchParams.get('v');

    if (!bookToken) {
      targetElement.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 3rem auto; padding: 2rem; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center;">
          <h2 style="color: #0f172a; margin-bottom: 0.5rem;">Select a Book to Read</h2>
          <p style="color: #64748b; font-size: 0.95rem;">No book token was specified. Please click a book from the library.</p>
        </div>
      `;
      return;
    }

    targetElement.innerHTML = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 3rem auto; padding: 2rem; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center;">
        <div style="display: inline-block; width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: bl-spin 0.8s linear infinite;"></div>
        <p style="color: #64748b; margin-top: 1rem; font-size: 0.95rem;">Securely loading book...</p>
        <style>@keyframes bl-spin { 100% { transform: rotate(360deg); } }</style>
      </div>
    `;

    const book = await fetchBookDetails(bookToken);
    if (!book || !book.success) {
      targetElement.innerHTML = `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 3rem auto; padding: 2rem; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">⏱️</div>
          <h2 style="color: #ef4444; margin-bottom: 0.5rem;">Link Expired or Invalid</h2>
          <p style="color: #64748b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem;">
            For copyright and security protection, dynamic book links are valid for 1.5 seconds. Please return to the previous page and click the link again.
          </p>
          <button onclick="window.history.back()" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer;">Go Back</button>
        </div>
      `;
      return;
    }

    targetElement.innerHTML = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 2rem; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <div style="display: flex; flex-wrap: wrap; gap: 2rem; align-items: center;">
          <div style="flex: 0 0 200px; text-align: center; margin: 0 auto;">
            <img src="${book.image || 'https://www.ieltsbuddy.com/images/cambridge-ielts-books.jpg'}" alt="${book.title}" style="max-width: 100%; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);" />
          </div>
          <div style="flex: 1; min-width: 280px;">
            <span style="display: inline-block; background: #eff6ff; color: #2563eb; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">${book.category || 'IELTS Book'}</span>
            <h1 style="color: #0f172a; font-size: 1.65rem; margin: 0 0 0.75rem 0; font-weight: 800;">${book.title}</h1>
            <p style="color: #475569; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">${book.description || ''}</p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
              <a href="${book.download || '#'}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; background: #2563eb; color: #ffffff; padding: 0.85rem 1.75rem; border-radius: 10px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(37,99,235,0.25); transition: transform 0.2s;">
                📖 Read Online
              </a>
              <a href="${book.download || '#'}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; justify-content: center; background: #0f172a; color: #ffffff; padding: 0.85rem 1.75rem; border-radius: 10px; font-weight: 600; text-decoration: none; transition: transform 0.2s;">
                📥 Read Book
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindBookLinks();
      autoInitReader();
    });
  } else {
    bindBookLinks();
    autoInitReader();
  }

  // Public API
  window.BookBridge = {
    authorized: true,
    apiKey: apiKey,
    sync: bindBookLinks,
    initReader: autoInitReader,
    getApiUrl: () => apiUrl,
    generateUrl: getInstantBookUrl,
    generateToken: generateInstantToken,
    fetchBook: fetchBookDetails,
    expiryMs: EXPIRY_MS
  };
})();
