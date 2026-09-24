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

const CLICKS_FILE = path.join(__dirname, 'data', 'clicks.json');
const REPORT_TIME_ZONE = 'Asia/Dhaka';

function getReportDate(offsetDays = 0) {
  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: REPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const getPart = (type) => Number(dateParts.find((part) => part.type === type)?.value);
  const date = new Date(Date.UTC(getPart('year'), getPart('month') - 1, getPart('day')));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getClicksData() {
  try {
    if (fs.existsSync(CLICKS_FILE)) {
      return JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading clicks.json:', err);
  }
  return { total_clicks: 0, daily: {}, countries: {} };
}

function saveClicksData(data) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(CLICKS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing clicks.json:', err);
  }
}

const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');
const BANNERS_FILE = path.join(__dirname, 'data', 'banners.json');

function getSettingsData() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading settings.json:', err);
  }
  return { bannersPublished: false, whatsappNumber: '8801762050353' };
}

function saveSettingsData(data) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');

    const apiDir = path.join(__dirname, 'api');
    if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'settings'), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing settings.json:', err);
  }
}

function getBannersData() {
  try {
    if (fs.existsSync(BANNERS_FILE)) {
      return JSON.parse(fs.readFileSync(BANNERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading banners.json:', err);
  }
  return {
    bannersPublished: false,
    whatsappNumber: '8801762050353'
  };
}

function saveBannersData(data) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(BANNERS_FILE, JSON.stringify(data, null, 2), 'utf8');

    const apiDir = path.join(__dirname, 'api');
    if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'banners'), JSON.stringify(data, null, 2), 'utf8');

    saveSettingsData({
      bannersPublished: data.bannersPublished ?? false,
      whatsappNumber: data.whatsappNumber || '8801762050353'
    });
  } catch (err) {
    console.error('Error writing banners.json:', err);
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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-admin-key',
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-admin-key',
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

  // API Endpoint: /api/settings
  if (url.pathname === '/api/settings' || url.pathname === '/api/settings/') {
    if (req.method === 'GET') {
      return sendJson(res, 200, getSettingsData());
    }
    if (req.method === 'POST') {
      if (!checkApiKey(req, url)) {
        return sendJson(res, 401, { error: 'Unauthorized: Invalid or missing API key.' });
      }
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(bodyData || '{}');
          const current = getSettingsData();
          const updated = {
            bannersPublished: typeof parsed.bannersPublished === 'boolean' ? parsed.bannersPublished : current.bannersPublished,
            whatsappNumber: parsed.whatsappNumber ? String(parsed.whatsappNumber).trim().replace(/\D/g, '') : current.whatsappNumber
          };
          saveSettingsData(updated);
          return sendJson(res, 200, { success: true, settings: updated });
        } catch (err) {
          return sendJson(res, 400, { error: 'Invalid JSON payload' });
        }
      });
      return;
    }
  }

  // API Endpoint: /api/banners
  if (url.pathname === '/api/banners' || url.pathname === '/api/banners/') {
    if (req.method === 'GET') {
      return sendJson(res, 200, getBannersData());
    }
    if (req.method === 'POST') {
      if (!checkApiKey(req, url)) {
        return sendJson(res, 401, { error: 'Unauthorized: Invalid or missing API key.' });
      }
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(bodyData || '{}');
          saveBannersData(parsed);
          return sendJson(res, 200, { success: true, banners: parsed });
        } catch (err) {
          return sendJson(res, 400, { error: 'Invalid JSON payload' });
        }
      });
      return;
    }
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

  const settingsFilePath = path.join(__dirname, 'data', 'settings.json');
  const apiSettingsFilePath = path.join(__dirname, 'api', 'settings');
  function getSettingsData() {
    try {
      if (fs.existsSync(settingsFilePath)) {
        return JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
      }
    } catch (_) {}
    return { bannersPublished: true, whatsappNumber: '8801711777508' };
  }
  function saveSettingsData(data) {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      fs.writeFileSync(settingsFilePath, jsonStr, 'utf8');
      if (fs.existsSync(path.dirname(apiSettingsFilePath))) {
        fs.writeFileSync(apiSettingsFilePath, jsonStr, 'utf8');
      }
    } catch (e) {
      console.error('Error saving settings.json:', e);
    }
  }

  // API Endpoint: /api/settings
  if (url.pathname === '/api/settings' || url.pathname === '/api/settings/') {
    if (req.method === 'GET') {
      return sendJson(res, 200, getSettingsData());
    }
    if (req.method === 'POST') {
      let bodyData = '';
      req.on('data', chunk => { bodyData += chunk; });
      req.on('end', () => {
        let body = {};
        try {
          body = JSON.parse(bodyData || '{}');
        } catch (_) {}

        const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key') || body.adminKey || body.key;
        if (adminKey !== API_KEY) {
          return sendJson(res, 401, { error: 'Invalid admin key.' });
        }

        const current = getSettingsData();
        if (typeof body.bannersPublished === 'boolean') {
          current.bannersPublished = body.bannersPublished;
        }
        if (typeof body.whatsappNumber === 'string' && body.whatsappNumber.trim()) {
          current.whatsappNumber = body.whatsappNumber.trim().replace(/\D/g, '');
        }

        saveSettingsData(current);
        return sendJson(res, 200, { success: true, settings: current });
      });
      return;
    }
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  // API Endpoint: /api/claim-clicks/countries
  if (url.pathname === '/api/claim-clicks/countries') {
    if (req.method !== 'GET') {
      return sendJson(res, 405, { error: 'Method not allowed.' });
    }
    const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
    if (adminKey !== API_KEY) {
      return sendJson(res, 401, { error: 'Invalid admin key.' });
    }
    const dateStr = url.searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return sendJson(res, 400, { error: 'A valid date is required (YYYY-MM-DD).' });
    }
    const data = getClicksData();
    const dateCountries = (data.countries && data.countries[dateStr]) || {};
    const countries = Object.entries(dateCountries)
      .map(([country_code, total_clicks]) => ({ country_code, total_clicks }))
      .sort((a, b) => b.total_clicks - a.total_clicks);
    return sendJson(res, 200, { date: dateStr, countries });
  }

  // API Endpoint: /api/claim-clicks
  if (url.pathname === '/api/claim-clicks') {
    const data = getClicksData();

    if (req.method === 'GET') {
      const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 365);
      const dailyList = Object.entries(data.daily || {})
        .map(([click_date, total_clicks]) => ({ click_date, total_clicks }))
        .sort((a, b) => b.click_date.localeCompare(a.click_date))
        .slice(0, days);
      return sendJson(res, 200, {
        count: data.total_clicks || 0,
        daily: dailyList,
        timeZone: REPORT_TIME_ZONE
      });
    }

    if (req.method === 'POST') {
      const today = getReportDate();
      const country = 'XX';
      data.total_clicks = (data.total_clicks || 0) + 1;
      data.daily = data.daily || {};
      data.daily[today] = (data.daily[today] || 0) + 1;
      data.countries = data.countries || {};
      data.countries[today] = data.countries[today] || {};
      data.countries[today][country] = (data.countries[today][country] || 0) + 1;
      saveClicksData(data);
      return sendJson(res, 200, { count: data.total_clicks });
    }

    if (req.method === 'DELETE') {
      const adminKey = req.headers['x-admin-key'] || url.searchParams.get('key');
      if (adminKey !== API_KEY) {
        return sendJson(res, 401, { error: 'Invalid admin key.' });
      }
      const cutoffDate = getReportDate(-6);
      let deletedRows = 0;
      let deletedClicks = 0;
      for (const [dateKey, clicks] of Object.entries(data.daily || {})) {
        if (dateKey < cutoffDate) {
          deletedRows += 1;
          deletedClicks += clicks;
          delete data.daily[dateKey];
        }
      }
      for (const dateKey of Object.keys(data.countries || {})) {
        if (dateKey < cutoffDate) {
          delete data.countries[dateKey];
        }
      }
      saveClicksData(data);
      return sendJson(res, 200, { cutoffDate, deletedRows, deletedClicks });
    }

    return sendJson(res, 405, { error: 'Method not allowed.' });
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

  // Route /count /count/ -> count/index.html
  if (url.pathname === '/count' || url.pathname === '/count/' || url.pathname === '/count/index.html') {
    const filePath = path.join(__dirname, 'count', 'index.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE_HEADERS });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  // Route /admin /admin/ -> admin.html
  if (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/index.html') {
    const filePath = path.join(__dirname, 'admin.html');
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE_HEADERS });
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
