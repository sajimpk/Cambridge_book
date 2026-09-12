import { registerServiceWorker } from './pwa.js';
import { initSponsoredAds, isGeoBlocked } from './vendor-core.js';
import { initSiteLocalization } from './site-language.js';
import {
  encodeBookId,
  decodeBookId,
  getBookUrl,
  validateToken,
  EXPIRY_MS
} from './url-helper.js';
import { createBookCoverHtml } from './book-element.js';

const booksUrl = '/data/book.json';
const pageTitle = document.getElementById('pageTitle');
const metaDescription = document.getElementById('metaDescription');
const canonicalLink = document.getElementById('canonicalLink');
const ogTitle = document.getElementById('ogTitle');
const ogDescription = document.getElementById('ogDescription');
const ogUrl = document.getElementById('ogUrl');
const ogImage = document.getElementById('ogImage');
const twitterTitle = document.getElementById('twitterTitle');
const twitterDescription = document.getElementById('twitterDescription');
const bookTitle = document.getElementById('bookTitle');
const bookTagline = document.getElementById('bookTagline');
const bookCoverSlot = document.getElementById('bookCoverSlot');
const bookImage = document.getElementById('bookImage');
const bookCategory = document.getElementById('bookCategory');
const bookDescription = document.getElementById('bookDescription');
const downloadButton = document.getElementById('downloadButton');
const directDownloadButton = document.getElementById('directDownloadButton');
const copyLinkButton = document.getElementById('copyLinkButton');
const shareButton = document.getElementById('shareButton');
const favoriteButton = document.getElementById('favoriteButton');
const viewsCount = document.getElementById('viewsCount');
const relatedCount = document.getElementById('relatedCount');
const bookExtra = document.getElementById('bookExtra');
const breadcrumbBook = document.getElementById('breadcrumbBook');
const relatedBooksGrid = document.getElementById('relatedBooksGrid');
const themeToggle = document.getElementById('themeToggle');
const bookDetail = document.getElementById('bookDetail');

let booksData = {};
let bookKey = null;
let activeTheme = localStorage.getItem('theme') || 'dark';

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
  }
  localStorage.setItem('theme', theme);
}

function getRawTokenFromUrl() {
  const searchParams = new URLSearchParams(window.location.search);
  const raw = searchParams.get('book') || searchParams.get('id') || searchParams.get('v');
  if (raw) return raw;
  const pathname = window.location.pathname.replace(/\/index\.html$/, '/');
  const match = pathname.match(/\/book\/([^/]+)/);
  if (match) return match[1];
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (last !== 'book' && last !== 'book.html' && last !== 'cambridge-ielts') return last;
  }
  return null;
}

function getRecentlyViewedBooks() {
  const list = JSON.parse(localStorage.getItem('book-recently-viewed') || '[]');
  return Array.isArray(list) ? list.filter(k => k && k !== bookKey) : [];
}

function saveRecentlyViewedBook(key) {
  const list = JSON.parse(localStorage.getItem('book-recently-viewed') || '[]');
  const filtered = Array.isArray(list) ? list.filter(k => k !== key) : [];
  filtered.unshift(key);
  localStorage.setItem('book-recently-viewed', JSON.stringify(filtered.slice(0, 6)));
}

function updateSeo(book) {
  const currentHref = window.location.href;
  if (pageTitle) pageTitle.textContent = `${book.title} • Book Library`;
  if (metaDescription) metaDescription.content = book.description || '';
  if (canonicalLink) canonicalLink.href = currentHref;
  if (ogTitle) ogTitle.content = book.title;
  if (ogDescription) ogDescription.content = book.description || '';
  if (ogUrl) ogUrl.content = currentHref;
  if (ogImage) ogImage.content = book.image || '/assets/images/placeholder.svg';
  if (twitterTitle) twitterTitle.content = book.title;
  if (twitterDescription) twitterDescription.content = book.description || '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    'name': book.title,
    'description': book.description,
    'url': currentHref,
    'genre': book.category || 'Book',
    'publisher': {
      '@type': 'Organization',
      'name': 'Book Library'
    }
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function populateBookDetails(book) {
  if (bookTitle) bookTitle.textContent = book.title;
  if (breadcrumbBook) breadcrumbBook.textContent = book.title;
  if (bookTagline) bookTagline.textContent = book.description || '';
  
  const coverHtml = createBookCoverHtml(book, bookKey, { size: 'large' });
  const coverContainer = bookCoverSlot || document.querySelector('.book-cover-frame');
  if (coverContainer) {
    const existingImg = coverContainer.querySelector('#bookImage');
    if (existingImg) existingImg.remove();
    let slot = coverContainer.querySelector('#bookCoverSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'bookCoverSlot';
      slot.style.width = '100%';
      slot.style.display = 'flex';
      slot.style.justifyContent = 'center';
      slot.style.zIndex = '2';
      coverContainer.appendChild(slot);
    }
    slot.innerHTML = coverHtml;
  }

  if (bookCategory) bookCategory.textContent = book.category || 'Book';
  if (bookDescription) bookDescription.textContent = book.description || '';
  if (downloadButton) {
    downloadButton.href = book.download || '#';
    downloadButton.textContent = 'Read Online';
  }
  if (directDownloadButton) {
    directDownloadButton.href = book.download || '#';
    directDownloadButton.textContent = 'Read Book';
  }
  updateSeo(book);
  renderBookExtras(book);
}

function renderBookExtras(book) {
  if (!bookExtra) return;
  const recent = getRecentlyViewedBooks();
  const extraDesc = book.extraDescription || `<p>${book.description || ''}</p>`;

  bookExtra.innerHTML = `
    <div class="book-details-grid">
      <div class="book-details-item">
        <strong>Title:</strong> ${book.title}
      </div>
      <div class="book-details-item">
        <strong>Category:</strong> ${book.category || 'Book'}
      </div>
      <div class="book-details-item">
        <strong>Online Reading:</strong> <a href="${book.download}" target="_blank" rel="noopener noreferrer">Open Online</a>
      </div>
      <div class="book-details-item">
        <strong>Reference ID:</strong> ${bookKey}
      </div>
      <div class="book-extra-content">
        ${extraDesc}
      </div>
    </div>
    ${recent.length > 0 ? `
      <div class="book-recently-viewed">
        <h3>Recently viewed</h3>
        <div class="recently-viewed-list">
          ${recent.map(rk => {
            const rb = booksData[rk];
            return `<a class="recent-book-link" href="${getBookUrl(rk)}">${rb ? rb.title : rk}</a>`;
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function setViewCount() {
  if (!viewsCount) return;
  const storageKey = `book-view-${bookKey}`;
  const count = Number(localStorage.getItem(storageKey)) || 0;
  localStorage.setItem(storageKey, count + 1);
  viewsCount.textContent = `Views: ${count + 1}`;
}

function populateRelatedBooks(currentBook) {
  if (!relatedBooksGrid) return;
  const firstWord = (currentBook.title || '').toLowerCase().split(' ')[0];
  const related = Object.entries(booksData)
    .filter(([k]) => k !== bookKey)
    .filter(([, b]) => (b.title || '').toLowerCase().includes(firstWord))
    .slice(0, 4);

  if (relatedCount) relatedCount.textContent = `Related (${related.length})`;

  relatedBooksGrid.innerHTML = '';
  related.forEach(([k, b]) => {
    const card = document.createElement('article');
    card.className = 'card';
    const coverHtml = createBookCoverHtml(b, k);
    card.innerHTML = `
      <div class="card__media" style="padding: 1rem; background: var(--surface-strong); display: flex; justify-content: center; align-items: center;">
        ${coverHtml}
      </div>
      <div class="card__content">
        <h3 class="card__title">${b.title}</h3>
        <p class="card__description">${b.description || ''}</p>
        <a class="button button-primary" style="width: 100%; margin-top: 0.5rem;" href="${getBookUrl(k)}">Read Book</a>
      </div>
    `;
    relatedBooksGrid.appendChild(card);
  });
}

function setFavorite() {
  if (!favoriteButton) return;
  const favs = JSON.parse(localStorage.getItem('book-favorites') || '[]');
  if (favs.includes(bookKey)) {
    favoriteButton.textContent = 'Favorite ✓';
    favoriteButton.disabled = true;
    return;
  }
  favs.push(bookKey);
  localStorage.setItem('book-favorites', JSON.stringify(favs));
  favoriteButton.textContent = 'Favorite ✓';
  favoriteButton.disabled = true;
}

function loadFavoriteState() {
  if (!favoriteButton) return;
  const favs = JSON.parse(localStorage.getItem('book-favorites') || '[]');
  if (favs.includes(bookKey)) {
    favoriteButton.textContent = 'Favorite ✓';
    favoriteButton.disabled = true;
  }
}

function installClipboard() {
  if (!copyLinkButton) return;
  copyLinkButton.addEventListener('click', async () => {
    try {
      // Copies the current page URL (which will expire after 1.5s)
      await navigator.clipboard.writeText(window.location.href);
      copyLinkButton.textContent = 'Link Copied!';
      setTimeout(() => {
        copyLinkButton.textContent = 'Copy Link';
      }, 1500);
    } catch (err) {
      console.error(err);
    }
  });
}

function installShare() {
  if (!shareButton) return;
  shareButton.addEventListener('click', async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: bookTitle ? bookTitle.textContent : '',
        text: bookDescription ? bookDescription.textContent : '',
        url: window.location.href
      });
    } catch (err) {
      console.error(err);
    }
  });
}

async function loadBook() {
  const rawToken = getRawTokenFromUrl();
  if (!rawToken) {
    window.location.href = '/404.html';
    return;
  }

  // Strict 1.5-Second Expiration Check
  const validation = validateToken(rawToken);
  if (!validation.valid || validation.expired) {
    // Expired (> 1.5 seconds) or invalid -> strictly 404!
    window.location.href = '/404.html';
    return;
  }

  try {
    const res = await fetch(booksUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Books file not found');
    booksData = await res.json();

    bookKey = validation.bookId;
    if (!bookKey || !booksData[bookKey]) {
      window.location.href = '/404.html';
      return;
    }

    const currentBook = booksData[bookKey];
    populateBookDetails(currentBook);
    setViewCount();
    populateRelatedBooks(currentBook);
    saveRecentlyViewedBook(bookKey);
    loadFavoriteState();
    installClipboard();
    installShare();

    if (bookDetail) {
      bookDetail.removeAttribute('aria-busy');
    }

  } catch (err) {
    console.error('Failed to load book:', err);
    window.location.href = '/404.html';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    activeTheme = activeTheme === 'light' ? 'dark' : 'light';
    setTheme(activeTheme);
  });
}

if (favoriteButton) {
  favoriteButton.addEventListener('click', () => setFavorite());
}

setTheme(activeTheme);
loadBook();
registerServiceWorker();
initSponsoredAds();
initSiteLocalization();