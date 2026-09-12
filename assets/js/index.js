import { registerServiceWorker } from './pwa.js';
import { initSponsoredAds, isGeoBlocked } from './vendor-core.js';
import { initSiteLocalization } from './site-language.js';
import { encodeBookId, decodeBookId, getBookUrl } from './url-helper.js';
import { createBookCoverHtml } from './book-element.js';

const booksUrl = '/data/book.json';
const searchInput = document.getElementById('searchInput');
const booksGrid = document.getElementById('booksGrid');
const searchMeta = document.getElementById('searchMeta');
const themeToggle = document.getElementById('themeToggle');

let booksData = {};
let booksList = [];
let activeTheme = localStorage.getItem('theme') || 'light';

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }
  localStorage.setItem('theme', theme);
}

function createCard(id, book) {
  const card = document.createElement('article');
  card.className = 'card';
  const coverHtml = createBookCoverHtml(book, id);
  const targetUrl = getBookUrl(id);

  card.innerHTML = `
    <div class="card__media" style="padding: 1.25rem 1rem; background: var(--surface-strong); display: flex; justify-content: center; align-items: center; border-radius: var(--radius-md) var(--radius-md) 0 0;">
      ${coverHtml}
    </div>
    <div class="card__content">
      <span class="card__category">${book.category || 'IELTS'}</span>
      <h3 class="card__title">${book.title}</h3>
      <p class="card__description">${book.description || ''}</p>
      <a class="button button-primary book-action-btn" data-book-id="${id}" style="width: 100%; margin-top: 0.75rem;" href="${targetUrl}">Read Online</a>
    </div>
  `;
  return card;
}

function renderBooks(list, isFiltered = false) {
  if (!booksGrid) return;
  booksGrid.innerHTML = '';

  if (!isFiltered && list.length === 0) {
    // Render all books by default
    const fragment = document.createDocumentFragment();
    booksList.forEach(id => {
      fragment.appendChild(createCard(id, booksData[id]));
    });
    booksGrid.appendChild(fragment);
    if (searchMeta) searchMeta.textContent = `${booksList.length} books available`;
    return;
  }

  if (list.length === 0) {
    booksGrid.innerHTML = `
      <div class="search-placeholder" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.5rem;">🔍</span>
        <h3>No books found</h3>
        <p style="color: var(--text-muted);">Try searching with another keyword like "Cambridge", "16", "Mindset", or "Writing".</p>
      </div>
    `;
    if (searchMeta) searchMeta.textContent = '0 results';
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach(id => {
    fragment.appendChild(createCard(id, booksData[id]));
  });
  booksGrid.appendChild(fragment);
  if (searchMeta) searchMeta.textContent = `${list.length} books found`;
}

function filterBooks(query) {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  return booksList.filter(id => {
    const b = booksData[id];
    if (!b) return false;
    return (
      (b.title && b.title.toLowerCase().includes(q)) ||
      (b.description && b.description.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q)) ||
      id.toLowerCase().includes(q)
    );
  });
}

async function fetchBooks() {
  try {
    const res = await fetch(booksUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load books');
    booksData = await res.json();
    booksList = Object.keys(booksData);
    renderBooks([], false);
  } catch (err) {
    if (booksGrid) {
      booksGrid.innerHTML = '<p class="error-meta" style="grid-column: 1 / -1; text-align: center;">Failed to load books. Please refresh the page.</p>';
    }
    console.error(err);
  }
}

function installKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

function redirectToBookFromQuery() {
  const searchParams = new URLSearchParams(window.location.search);
  const raw = searchParams.get('book') || searchParams.get('id') || searchParams.get('v');
  if (raw) {
    const decoded = decodeBookId(raw);
    const targetUrl = getBookUrl(decoded);
    window.location.replace(targetUrl);
  }
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim();
    if (!val) {
      renderBooks([], false);
    } else {
      const filtered = filterBooks(val);
      renderBooks(filtered, true);
    }
  });
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    activeTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(activeTheme);
  });
}

function applyAdSettings() {
  const showAds = localStorage.getItem('show-ads') !== 'false' && !isGeoBlocked();
  const adsWrap = document.querySelector('.ads-wrapper');
  if (adsWrap) {
    adsWrap.style.display = showAds ? '' : 'none';
  }
}

function initCloseAds() {
  const btn = document.getElementById('closeAdsBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      localStorage.setItem('show-ads', 'false');
      applyAdSettings();
    });
  }
}

setTheme(activeTheme);
installKeyboardShortcuts();
redirectToBookFromQuery();
fetchBooks();
registerServiceWorker();
initSponsoredAds();
initSiteLocalization();
applyAdSettings();
initCloseAds();

// Ensure all clicked book links generate a 0ms fresh token at click moment
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('a[data-book-id]');
  if (btn && btn.dataset.bookId) {
    btn.href = getBookUrl(btn.dataset.bookId);
  }
}, { passive: true });

document.addEventListener('click', (e) => {
  const btn = e.target.closest('a[data-book-id]');
  if (btn && btn.dataset.bookId) {
    btn.href = getBookUrl(btn.dataset.bookId);
  }
});

window.addEventListener('storage', e => {
  if (e.key === 'show-ads') applyAdSettings();
});