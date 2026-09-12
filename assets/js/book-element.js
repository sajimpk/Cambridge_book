/**
 * Dynamic CSS Book Cover Element Generator
 * Generates rich, realistic, pure HTML/CSS 3D book cover elements with distinct color themes,
 * gold foil badges, spine depth, and page layers — without relying on external image files.
 */

const PALETTES = [
  { bg: 'linear-gradient(145deg, #1e3a8a 0%, #0c1527 100%)', accent: '#38bdf8', gold: '#fbbf24', spine: '#172554' }, // Navy / Azure
  { bg: 'linear-gradient(145deg, #831843 0%, #2e081d 100%)', accent: '#f472b6', gold: '#fde047', spine: '#500724' }, // Crimson / Plum
  { bg: 'linear-gradient(145deg, #065f46 0%, #022018 100%)', accent: '#34d399', gold: '#facc15', spine: '#064e3b' }, // Emerald / Jade
  { bg: 'linear-gradient(145deg, #4c1d95 0%, #170d38 100%)', accent: '#a78bfa', gold: '#fef08a', spine: '#2e1065' }, // Royal Purple
  { bg: 'linear-gradient(145deg, #9a3412 0%, #380e03 100%)', accent: '#fb923c', gold: '#fde68a', spine: '#7c2d12' }, // Amber / Rust
  { bg: 'linear-gradient(145deg, #0f766e 0%, #092e2b 100%)', accent: '#2dd4bf', gold: '#fef9c3', spine: '#115e59' }, // Teal Ocean
  { bg: 'linear-gradient(145deg, #312e81 0%, #11102e 100%)', accent: '#818cf8', gold: '#fde047', spine: '#1e1b4b' }, // Indigo
  { bg: 'linear-gradient(145deg, #1e293b 0%, #07090f 100%)', accent: '#38bdf8', gold: '#e2e8f0', spine: '#0f172a' }, // Obsidian Titanium
];

export function getBookPalette(id = '', title = '') {
  let hash = 0;
  const str = (id || title).toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

export function parseBookVolume(id = '', title = '') {
  const match = (title + ' ' + id).match(/(?:ielts\s*[-_]?|cambridge\s*[-_]?|level\s*[-_]?|part\s*[-_]?|test\s*[-_]?)(\d{1,2})/i);
  if (match) return match[1].padStart(2, '0');
  
  if (/mindset.*1/i.test(id)) return '01';
  if (/mindset.*2/i.test(id)) return '02';
  if (/mindset.*foundation/i.test(id)) return 'FD';
  if (/official.*guide/i.test(id)) return 'OG';
  if (/speaking/i.test(id)) return 'SP';
  if (/writing/i.test(id)) return 'WR';
  if (/reading/i.test(id)) return 'RD';
  if (/makkar/i.test(id)) return 'KM';
  return 'PDF';
}

export function createBookCoverHtml(book = {}, id = '', options = {}) {
  const title = book.title || id || 'IELTS Book';
  const category = book.category || 'CAMBRIDGE IELTS';
  const volNum = parseBookVolume(id, title);
  const palette = getBookPalette(id, title);
  const isLarge = options.size === 'large';

  const publisher = /cambridge/i.test(title) || /cambridge/i.test(id) ? 'CAMBRIDGE' : (book.category || 'IELTS PREP');
  const series = /mindset/i.test(title) ? 'MINDSET FOR IELTS' : (/official.*guide/i.test(title) ? 'OFFICIAL GUIDE' : 'AUTHENTIC PRACTICE');

  return `
    <div class="css-book-card ${isLarge ? 'css-book-card--large' : ''}" style="--book-bg: ${palette.bg}; --book-accent: ${palette.accent}; --book-gold: ${palette.gold}; --book-spine: ${palette.spine};" aria-label="${title} Cover">
      <div class="book-3d-wrapper">
        <!-- Spine Edge 3D -->
        <div class="book-spine-edge">
          <span class="spine-text">${publisher} • ${title}</span>
        </div>
        
        <!-- Front Cover -->
        <div class="book-cover-surface">
          <!-- Realistic Gloss & Lighting -->
          <div class="book-gloss-overlay"></div>
          
          <!-- Top Header -->
          <div class="book-top-row">
            <span class="book-brand-badge">${publisher}</span>
            <span class="book-verified-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              AUTHENTIC
            </span>
          </div>

          <!-- Center Edition Number / Logo -->
          <div class="book-center-content">
            <span class="book-series-name">${series}</span>
            <div class="book-volume-badge">
              <span class="book-volume-number">${volNum}</span>
            </div>
            <h3 class="book-cover-title">${title}</h3>
          </div>

          <!-- Bottom Footer -->
          <div class="book-bottom-row">
            <span class="book-feature-tag">OFFICIAL EDITION</span>
            <span class="book-format-tag">READ</span>
          </div>

          <!-- Gold Ribbon Bookmark -->
          <div class="book-ribbon-tag"></div>
        </div>

        <!-- 3D Page Layers (Right & Bottom) -->
        <div class="book-pages-stack"></div>
      </div>
    </div>
  `;
}
