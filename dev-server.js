import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePerRequestToken, validateToken, decodeBookId, EXPIRY_MS } from './assets/js/url-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 8000;
const API_KEY = 'sajimpk';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function getBooksData() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'data', 'book.json'), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    ...NO_CACHE_HEADERS
  });
  res.end(JSON.stringify(data));
}

function checkApiKey(req, url) {
  const headerKey = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  const queryKey = url.searchParams.get('api_key') || url.searchParams.get('key');
  return headerKey === API_KEY || queryKey === API_KEY;
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const origin = `http://${host}`;
  const url = new URL(req.url, origin);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  // API Endpoint: /api/data-books (Returns data_book only array)
  if (url.pathname === '/api/data-books' || url.pathname === '/api/data-books/' || url.pathname === '/api/data-book' || url.pathname === '/api/tags') {
    if (!checkApiKey(req, url)) {
      return sendJson(res, 401, {
        error: 'Unauthorized: Invalid or missing API key. Pass ?key=sajimpk or x-api-key header.'
      });
    }

    const booksData = getBooksData();
    const dataBooksOnly = Object.keys(booksData);

    // Return pure array of data_book names only
    return sendJson(res, 200, dataBooksOnly);
  }



function resolveCallerBaseUrl(req, url, body = {}) {
  const explicit =
    url.searchParams.get('site_url') ||
    url.searchParams.get('base_url') ||
    url.searchParams.get('site') ||
    url.searchParams.get('domain') ||
    url.searchParams.get('origin') ||
    url.searchParams.get('target_origin') ||
    body?.site_url ||
    body?.base_url ||
    body?.site ||
    body?.domain ||
    body?.origin ||
    body?.target_origin ||
    req.headers['x-site-url'] ||
    req.headers['x-origin'] ||
    req.headers['x-target-origin'];

  if (explicit) {
    let formatted = String(explicit).trim();
    if (!/^https?:\/\//i.test(formatted)) {
      formatted = `https://${formatted}`;
    }
    try {
      return new URL(formatted).origin;
    } catch (_) {
      return formatted.replace(/\/+$/, '');
    }
  }

  const originHeader = req.headers['origin'];
  if (originHeader && originHeader !== 'null' && originHeader !== '') {
    return originHeader.replace(/\/+$/, '');
  }

  const refererHeader = req.headers['referer'];
  if (refererHeader) {
    try {
      const refUrl = new URL(refererHeader);
      if (refUrl.origin && refUrl.origin !== 'null') {
        return refUrl.origin.replace(/\/+$/, '');
      }
    } catch (_) {}
  }

  return `http://${req.headers.host || `127.0.0.1:${PORT}`}`.replace(/\/+$/, '');
}

  // API Endpoint: /api/books/resolve
  if (url.pathname === '/api/books/resolve' || url.pathname === '/api/book-link') {
    if (!checkApiKey(req, url)) {
      return sendJson(res, 401, { error: 'Unauthorized: Invalid or missing API key.' });
    }
    const booksData = getBooksData();
    let bookId = url.searchParams.get('id') || url.searchParams.get('book');
    const baseUrl = resolveCallerBaseUrl(req, url);

    const handleResolve = (targetId, postData = {}) => {
      if (!targetId) {
        return sendJson(res, 400, { error: 'Missing book id. Pass ?id=book-id' });
      }
      const decodedKey = decodeBookId(targetId);
      const resolvedKey = booksData[targetId] ? targetId : (booksData[decodedKey] ? decodedKey : null);
      if (!resolvedKey) {
        return sendJson(res, 404, { error: 'Book not found' });
      }
      const token = generatePerRequestToken(resolvedKey);
      const book = booksData[resolvedKey];
      const finalBaseUrl = resolveCallerBaseUrl(req, url, postData);
      return sendJson(res, 200, {
        success: true,
        id: resolvedKey,
        title: book.title,
        category: book.category || 'IELTS',
        token,
        url: `${finalBaseUrl}/book/?book=${token}`,
        path: `/book/?book=${token}`,
        relative_url: `/book/?book=${token}`
      });
    };

    if (req.method === 'POST') {
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(bodyData || '{}');
          handleResolve(parsed.id || parsed.book || bookId, parsed);
        } catch (_) {
          handleResolve(bookId);
        }
      });
      return;
    }

    return handleResolve(bookId);
  }

  // API Endpoint: /api/book-info or /api/book-details (Protected by API Key)
  if (url.pathname === '/api/book-info' || url.pathname === '/api/book-details') {
    if (!checkApiKey(req, url)) {
      return sendJson(res, 401, { error: 'Unauthorized: Invalid or missing API key.' });
    }
    const booksData = getBooksData();
    const bookId = url.searchParams.get('id') || url.searchParams.get('book');
    if (!bookId) {
      return sendJson(res, 400, { error: 'Missing book id parameter. Pass ?id=book-id or ?book=TOKEN' });
    }
    const validation = validateToken(bookId);
    const targetKey = validation.bookId || (booksData[bookId] ? bookId : null);
    if (!targetKey || !booksData[targetKey]) {
      return sendJson(res, 404, { error: 'Book not found or token expired.', id: bookId });
    }
    const book = booksData[targetKey];
    return sendJson(res, 200, {
      success: true,
      id: targetKey,
      title: book.title,
      description: book.description,
      category: book.category || 'IELTS',
      image: book.image,
      download: book.download,
      extraDescription: book.extraDescription || null
    });
  }

  // API Endpoint: /api/embed.js
  if (url.pathname === '/api/embed.js') {
    const filePath = path.join(__dirname, 'assets', 'js', 'embed.js');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        ...NO_CACHE_HEADERS
      });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Route /data-book -> data-book.html
  if (url.pathname === '/data-book' || url.pathname === '/data-book/') {
    const filePath = path.join(__dirname, 'data-book.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(filePath).pipe(res);
  }

  // Route /book /book/ -> book/index.html
  if (url.pathname === '/book' || url.pathname === '/book/' || url.pathname.startsWith('/book/')) {
    const filePath = path.join(__dirname, 'book', 'index.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE_HEADERS });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Route /list /list/ -> list/index.html
  if (url.pathname === '/list' || url.pathname === '/list/') {
    const filePath = path.join(__dirname, 'list', 'index.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE_HEADERS });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Route /demo-site /demo-site/ -> demo-site/index.html
  if (url.pathname === '/demo-site' || url.pathname === '/demo-site/') {
    const filePath = path.join(__dirname, 'demo-site', 'index.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE_HEADERS });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Static File Serving
  let relativePath = decodeURIComponent(url.pathname).replace(/^\//, '');
  if (!relativePath || relativePath === '') relativePath = 'index.html';

  let filePath = path.join(__dirname, relativePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      ...NO_CACHE_HEADERS
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  // 404 Fallback
  const notFoundPath = path.join(__dirname, '404.html');
  if (fs.existsSync(notFoundPath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE_HEADERS });
    return fs.createReadStream(notFoundPath).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain', ...NO_CACHE_HEADERS });
  res.end('404 Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
  console.log(`API data-books: http://127.0.0.1:${PORT}/api/data-books?key=${API_KEY}`);
});
