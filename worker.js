const BUTTON_ID = 'claim-offer';
const REPORT_TIME_ZONE = 'Asia/Dhaka';
const AUTO_CLEANUP_THRESHOLD_BYTES = 100 * 1024 * 1024;

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

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type, Authorization, x-api-key, x-admin-key');
  return new Response(JSON.stringify(data), { ...init, headers });
}

let tablesEnsured = false;
async function ensureTables(database) {
  if (tablesEnsured || !database) return;
  try {
    await database.batch([
      database.prepare(`
        CREATE TABLE IF NOT EXISTS click_stats (
          button_id TEXT PRIMARY KEY,
          total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      database.prepare(`
        INSERT OR IGNORE INTO click_stats (button_id, total_clicks)
        VALUES ('claim-offer', 0)
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS daily_clicks (
          click_date TEXT PRIMARY KEY,
          total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0)
        )
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS daily_country_clicks (
          click_date TEXT NOT NULL,
          country_code TEXT NOT NULL,
          total_clicks INTEGER NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
          PRIMARY KEY (click_date, country_code)
        )
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS site_settings (
          setting_key TEXT PRIMARY KEY,
          setting_value TEXT NOT NULL
        )
      `),
      database.prepare(`
        INSERT OR IGNORE INTO site_settings (setting_key, setting_value)
        VALUES ('bannersPublished', 'false'), ('whatsappNumber', '8801762050353')
      `),
      database.prepare(`
        CREATE TABLE IF NOT EXISTS site_banners (
          banner_id TEXT PRIMARY KEY,
          banner_data TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)
    ]);
    tablesEnsured = true;
  } catch (err) {
    console.warn('Could not auto-ensure tables:', err);
  }
}

let inMemorySettings = { bannersPublished: false, whatsappNumber: '8801762050353' };

async function readSiteSettings(database) {
  if (!database) return inMemorySettings;
  try {
    await ensureTables(database);
    const rows = await database.prepare('SELECT setting_key, setting_value FROM site_settings').all();
    const settings = { ...inMemorySettings };
    if (rows && rows.results) {
      for (const row of rows.results) {
        if (row.setting_key === 'bannersPublished') {
          settings.bannersPublished = row.setting_value === 'true';
        }
        if (row.setting_key === 'whatsappNumber') {
          settings.whatsappNumber = row.setting_value;
        }
      }
    }
    inMemorySettings = settings;
    return settings;
  } catch (err) {
    console.warn('Could not read site_settings from D1:', err);
    return inMemorySettings;
  }
}

async function updateSiteSettings(database, newSettings) {
  if (typeof newSettings.bannersPublished === 'boolean') {
    inMemorySettings.bannersPublished = newSettings.bannersPublished;
  }
  if (typeof newSettings.whatsappNumber === 'string' && newSettings.whatsappNumber.trim()) {
    inMemorySettings.whatsappNumber = newSettings.whatsappNumber.trim().replace(/\D/g, '');
  }

  if (database) {
    try {
      await ensureTables(database);
      await database.batch([
        database.prepare(`
          INSERT INTO site_settings (setting_key, setting_value)
          VALUES ('bannersPublished', ?), ('whatsappNumber', ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
        `).bind(String(inMemorySettings.bannersPublished), String(inMemorySettings.whatsappNumber))
      ]);
    } catch (err) {
      console.warn('Could not update site_settings in D1:', err);
    }
  }

  return inMemorySettings;
}

let inMemoryBanners = null;

async function readSiteBanners(database, env, origin) {
  let banners = inMemoryBanners;

  if (database) {
    try {
      await ensureTables(database);
      const row = await database.prepare("SELECT banner_data FROM site_banners WHERE banner_id = 'all'").first();
      if (row && row.banner_data) {
        banners = JSON.parse(row.banner_data);
      }
    } catch (err) {
      console.warn('Could not read site_banners from D1:', err);
    }
  }

  if (!banners && env?.ASSETS) {
    try {
      const res = await env.ASSETS.fetch(new Request(new URL('/data/banners.json', origin)));
      if (res.ok) {
        banners = await res.json();
      }
    } catch (_) {}
  }

  if (!banners) {
    banners = {
      bannersPublished: false,
      whatsappNumber: '8801762050353'
    };
  }

  // Synchronize with site settings
  const settings = await readSiteSettings(database);
  banners.bannersPublished = settings.bannersPublished;
  banners.whatsappNumber = settings.whatsappNumber;
  inMemoryBanners = banners;
  return banners;
}

async function updateSiteBanners(database, newBanners) {
  inMemoryBanners = { ...newBanners };

  if (database) {
    try {
      await ensureTables(database);
      await database.prepare(`
        INSERT INTO site_banners (banner_id, banner_data, updated_at)
        VALUES ('all', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(banner_id) DO UPDATE SET
          banner_data = excluded.banner_data,
          updated_at = CURRENT_TIMESTAMP
      `).bind(JSON.stringify(newBanners)).run();
    } catch (err) {
      console.warn('Could not update site_banners in D1:', err);
    }
  }

  // Update site settings as well
  await updateSiteSettings(database, {
    bannersPublished: newBanners.bannersPublished,
    whatsappNumber: newBanners.whatsappNumber
  });

  return inMemoryBanners;
}


async function readClickCount(database) {
  await ensureTables(database);
  const row = await database
    .prepare('SELECT total_clicks FROM click_stats WHERE button_id = ?')
    .bind(BUTTON_ID)
    .first();

  return Number(row?.total_clicks || 0);
}

async function incrementClickCount(database, countryCode) {
  const clickDate = getReportDate();

  await database.batch([
    database.prepare(`
      INSERT INTO click_stats (button_id, total_clicks, updated_at)
      VALUES (?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(button_id) DO UPDATE SET
        total_clicks = total_clicks + 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(BUTTON_ID),
    database.prepare(`
      INSERT INTO daily_clicks (click_date, total_clicks)
      VALUES (?, 1)
      ON CONFLICT(click_date) DO UPDATE SET
        total_clicks = total_clicks + 1
    `).bind(clickDate),
    database.prepare(`
      INSERT INTO daily_country_clicks (click_date, country_code, total_clicks)
      VALUES (?, ?, 1)
      ON CONFLICT(click_date, country_code) DO UPDATE SET
        total_clicks = total_clicks + 1
    `).bind(clickDate, countryCode)
  ]);

  return readClickCount(database);
}

async function readDailyClicks(database, numberOfDays) {
  const result = await database
    .prepare(`
      SELECT click_date, total_clicks
      FROM daily_clicks
      ORDER BY click_date DESC
      LIMIT ?
    `)
    .bind(numberOfDays)
    .all();

  return result.results || [];
}

async function readCountryClicks(database, clickDate) {
  const result = await database
    .prepare(`
      SELECT country_code, total_clicks
      FROM daily_country_clicks
      WHERE click_date = ?
      ORDER BY total_clicks DESC, country_code ASC
    `)
    .bind(clickDate)
    .all();

  return result.results || [];
}

function hasValidAdminKey(request, env) {
  return Boolean(env.COUNT_ADMIN_KEY) && request.headers.get('x-admin-key') === env.COUNT_ADMIN_KEY;
}

async function deleteOldDailyClicks(database) {
  const cutoffDate = getReportDate(-6);
  const oldData = await database
    .prepare('SELECT COUNT(*) AS rows, COALESCE(SUM(total_clicks), 0) AS clicks FROM daily_clicks WHERE click_date < ?')
    .bind(cutoffDate)
    .first();
  const result = await database
    .prepare('DELETE FROM daily_clicks WHERE click_date < ?')
    .bind(cutoffDate)
    .run();
  const countryResult = await database
    .prepare('DELETE FROM daily_country_clicks WHERE click_date < ?')
    .bind(cutoffDate)
    .run();

  return {
    cutoffDate,
    deletedRows: Number(result.meta?.changes ?? oldData?.rows ?? 0),
    deletedCountryRows: Number(countryResult.meta?.changes || 0),
    deletedClicks: Number(oldData?.clicks || 0)
  };
}

async function runAutomaticStorageCleanup(database) {
  const sizeProbe = await database.prepare('SELECT 1 AS storage_check').run();
  const databaseSizeBytes = Number(sizeProbe.meta?.size_after || 0);

  if (databaseSizeBytes < AUTO_CLEANUP_THRESHOLD_BYTES) {
    console.log('D1 auto-cleanup skipped.', {
      databaseSizeBytes,
      thresholdBytes: AUTO_CLEANUP_THRESHOLD_BYTES
    });
    return;
  }

  const cleanup = await deleteOldDailyClicks(database);
  console.log('D1 auto-cleanup completed.', {
    databaseSizeBytes,
    thresholdBytes: AUTO_CLEANUP_THRESHOLD_BYTES,
    ...cleanup
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function getBooksData(env, origin) {
  try {
    const res = await env.ASSETS.fetch(new Request(new URL('/data/book.json', origin)));
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to load books data in worker:', err);
  }
  return {};
}

const CIPHER_KEY = 0x5a;
const EXPIRY_MS = 1500; // Strictly 1.5 seconds (1500ms)

function encodeBookId(id) {
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

function validateToken(token) {
  if (!token) return { valid: false, reason: 'missing', bookId: null, expired: true };
  const parts = String(token).split('.');
  if (parts.length === 2) {
    const ts = parseInt(parts[0], 36);
    if (ts && !isNaN(ts)) {
      const now = Date.now();
      const age = now - ts;
      const isFresh = age >= -300 && age <= EXPIRY_MS;

      let str = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';

      try {
        const binary = atob(str);
        const salt = (ts % 127);
        const decodedBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          decodedBytes[i] = binary.charCodeAt(i) ^ (CIPHER_KEY ^ ((salt + i * 7) & 0x7f));
        }

        const decoded = new TextDecoder().decode(decodedBytes);
        const pipeIdx = decoded.indexOf('|');
        if (pipeIdx > 0) {
          const id = decoded.slice(0, pipeIdx);
          if (/^[a-zA-Z0-9_-]+$/.test(id)) {
            return {
              valid: isFresh,
              bookId: id,
              ageMs: age,
              timestamp: ts,
              expired: !isFresh
            };
          }
        }
      } catch (_) { }
    }
  }

  return { valid: false, reason: 'invalid_or_expired', bookId: null, expired: true };
}

function decodeBookId(token) {
  const result = validateToken(token);
  return result.valid ? result.bookId : null;
}

function hasValidApiKey(request, env, url) {
  const configuredKey = env.API_KEY || env.COUNT_ADMIN_KEY;
  if (!configuredKey) return false;
  const headerKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const queryKey = url.searchParams.get('api_key') || url.searchParams.get('key');
  return headerKey === configuredKey || queryKey === configuredKey;
}

function extractBookKey(url, booksData) {
  const rawToken = url.searchParams.get('book') || url.searchParams.get('id') || url.searchParams.get('v');
  if (rawToken) {
    const validation = validateToken(rawToken);
    if (validation.bookId && booksData && booksData[validation.bookId]) {
      return validation.bookId;
    }
    if (booksData && booksData[rawToken]) {
      return rawToken;
    }
    return null;
  }
  const cleanPath = url.pathname
    .replace(/^\/book\//, '')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\.html$/, '');

  if (cleanPath && cleanPath !== 'book') {
    const validation = validateToken(cleanPath);
    if (validation.bookId && booksData && booksData[validation.bookId]) {
      return validation.bookId;
    }
    if (booksData && booksData[cleanPath]) {
      return cleanPath;
    }
    return null;
  }
  return null;
}

function resolveCallerBaseUrl(request, url, body = {}) {
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
    request.headers.get('x-site-url') ||
    request.headers.get('x-origin') ||
    request.headers.get('x-target-origin');

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

  const originHeader = request.headers.get('origin');
  if (originHeader && originHeader !== 'null' && originHeader !== '') {
    return originHeader.replace(/\/+$/, '');
  }

  const refererHeader = request.headers.get('referer');
  if (refererHeader) {
    try {
      const refUrl = new URL(refererHeader);
      if (refUrl.origin && refUrl.origin !== 'null') {
        return refUrl.origin.replace(/\/+$/, '');
      }
    } catch (_) { }
  }

  return url.origin.replace(/\/+$/, '');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight CORS handler for external website requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Authorization, x-api-key, x-admin-key',
          'access-control-max-age': '86400'
        }
      });
    }

    if (request.method === 'GET' && (url.pathname === '/count' || url.pathname === '/count/' || url.pathname === '/count/index.html')) {
      const countPageUrl = new URL('/count/index.html', url.origin);
      return env.ASSETS.fetch(new Request(countPageUrl, request));
    }

    if (request.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/index.html')) {
      const adminPageUrl = new URL('/admin.html', url.origin);
      return env.ASSETS.fetch(new Request(adminPageUrl, request));
    }

    // Site Settings API (Banners status & WhatsApp number)
    if (url.pathname === '/api/settings' || url.pathname === '/api/settings/') {
      if (request.method === 'GET') {
        const settings = await readSiteSettings(env?.DB);
        return json(settings);
      }
      if (request.method === 'POST') {
        if (!hasValidApiKey(request, env, url)) {
          return json({ error: 'Unauthorized: Invalid or missing API/Admin key.' }, { status: 401 });
        }
        let body = {};
        try {
          body = await request.json();
        } catch (_) {}
        const updated = await updateSiteSettings(env?.DB, body);
        return json({ success: true, settings: updated });
      }
    }

    // Site Banners API (Full banner details + status)
    if (url.pathname === '/api/banners' || url.pathname === '/api/banners/') {
      if (request.method === 'GET') {
        const banners = await readSiteBanners(env?.DB, env, url.origin);
        return json(banners);
      }
      if (request.method === 'POST') {
        if (!hasValidApiKey(request, env, url)) {
          return json({ error: 'Unauthorized: Invalid or missing API/Admin key.' }, { status: 401 });
        }
        let body = {};
        try {
          body = await request.json();
        } catch (_) {}
        const updated = await updateSiteBanners(env?.DB, body);
        return json({ success: true, banners: updated });
      }
    }

    // Endpoint to show all available data_book attributes ONLY (pure array)
    if (url.pathname === '/api/data-books' || url.pathname === '/api/data-books/' || url.pathname === '/api/data-book' || url.pathname === '/api/tags') {
      if (!hasValidApiKey(request, env, url)) {
        return json({ error: 'Unauthorized: Invalid or missing API key. Pass x-api-key header or ?key= parameter.' }, { status: 401 });
      }

      const booksData = await getBooksData(env, url.origin);
      const dataBooksOnly = Object.keys(booksData);

      return json(dataBooksOnly);
    }

    // Resolve single book URL API
    if (url.pathname === '/api/books/resolve' || url.pathname === '/api/book-link') {
      if (!hasValidApiKey(request, env, url)) {
        return json({ error: 'Unauthorized: Invalid or missing API key.' }, { status: 401 });
      }

      const booksData = await getBooksData(env, url.origin);
      let postBody = {};
      let bookId = url.searchParams.get('id') || url.searchParams.get('book');
      if (request.method === 'POST') {
        try {
          postBody = await request.json();
          bookId = postBody.id || postBody.book || bookId;
        } catch (_) { }
      }

      if (!bookId) {
        return json({ error: 'Missing book id parameter. Pass ?id=book-id or POST { id: "book-id" }' }, { status: 400 });
      }

      const decodedKey = decodeBookId(bookId);
      const resolvedKey = booksData[bookId] ? bookId : (booksData[decodedKey] ? decodedKey : null);
      if (!resolvedKey) {
        return json({ error: 'Book not found.', id: bookId }, { status: 404 });
      }

      const baseUrl = resolveCallerBaseUrl(request, url, postBody);
      const token = encodeBookId(resolvedKey);
      const book = booksData[resolvedKey];
      return json({
        success: true,
        id: resolvedKey,
        title: book.title,
        category: book.category || 'IELTS',
        image: book.image,
        token,
        url: `${baseUrl}/book/?book=${token}`,
        path: `/book/?book=${token}`,
        relative_url: `/book/?book=${token}`
      });
    }

    // Book details API for third-party websites (Protected by API Key)
    if (url.pathname === '/api/book-info' || url.pathname === '/api/book-details') {
      if (!hasValidApiKey(request, env, url)) {
        return json({ error: 'Unauthorized: Invalid or missing API key. Pass x-api-key header or ?key= parameter.' }, { status: 401 });
      }

      const booksData = await getBooksData(env, url.origin);
      const bookId = url.searchParams.get('id') || url.searchParams.get('book');
      if (!bookId) {
        return json({ error: 'Missing book id parameter. Pass ?id=book-id or ?book=TOKEN' }, { status: 400 });
      }

      const validation = validateToken(bookId);
      const targetKey = validation.bookId || (booksData[bookId] ? bookId : null);
      if (!targetKey || !booksData[targetKey]) {
        return json({ error: 'Book not found or token expired.', id: bookId }, { status: 404 });
      }

      const book = booksData[targetKey];
      return json({
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

    // Embed Script route for external websites
    if (url.pathname === '/api/embed.js') {
      const embedScriptUrl = new URL('/assets/js/embed.js', url.origin);
      const scriptRes = await env.ASSETS.fetch(new Request(embedScriptUrl, request));
      const headers = new Headers(scriptRes.headers);
      headers.set('access-control-allow-origin', '*');
      headers.set('cache-control', 'no-store');
      headers.set('content-type', 'application/javascript; charset=utf-8');
      return new Response(scriptRes.body, { ...scriptRes, headers });
    }

    // Site settings endpoint (Promotional banners & WhatsApp)
    if (url.pathname === '/api/settings' || url.pathname === '/api/settings/') {
      if (request.method === 'GET') {
        const settings = await readSiteSettings(env.DB);
        return json(settings);
      }
      if (request.method === 'POST') {
        let postBody = {};
        try {
          postBody = await request.json();
        } catch (_) { }

        const adminKey = request.headers.get('x-admin-key') || url.searchParams.get('key') || postBody.adminKey || postBody.key;
        const validKey = env.COUNT_ADMIN_KEY || env.API_KEY;
        if (!adminKey || adminKey !== validKey) {
          return json({ error: 'Unauthorized: Invalid admin key.' }, { status: 401 });
        }

        const updated = await updateSiteSettings(env.DB, postBody);
        return json({ success: true, settings: updated });
      }
      return json({ error: 'Method not allowed.' }, { status: 405 });
    }

    if (url.pathname === '/api/claim-clicks/countries') {
      if (!env.DB) {
        return json({ error: 'Database binding (DB) is unavailable. Please check your wrangler.jsonc or Cloudflare Dashboard.' }, { status: 503 });
      }

      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed.' }, { status: 405, headers: { allow: 'GET, OPTIONS' } });
      }

      if (!env.COUNT_ADMIN_KEY) {
        return json({ error: 'Admin key is not configured.' }, { status: 503 });
      }

      if (!hasValidAdminKey(request, env)) {
        return json({ error: 'Invalid admin key.' }, { status: 401 });
      }

      const clickDate = url.searchParams.get('date') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(clickDate)) {
        return json({ error: 'A valid date is required (YYYY-MM-DD).' }, { status: 400 });
      }

      try {
        await ensureTables(env.DB);
        return json({
          date: clickDate,
          countries: await readCountryClicks(env.DB, clickDate)
        });
      } catch (error) {
        console.error('Country click report failed:', error);
        return json({ error: `Unable to load country click data: ${error.message || error}` }, { status: 500 });
      }
    }

    if (url.pathname === '/api/claim-clicks') {
      if (!env.DB) {
        return json({ error: 'Database binding (DB) is unavailable. Please check your wrangler.jsonc or Cloudflare Dashboard.' }, { status: 503 });
      }

      try {
        await ensureTables(env.DB);

        if (request.method === 'GET') {
          const requestedDays = Number.parseInt(url.searchParams.get('days') || '30', 10);
          const numberOfDays = Math.min(Math.max(requestedDays || 30, 1), 365);
          const [count, daily] = await Promise.all([
            readClickCount(env.DB),
            readDailyClicks(env.DB, numberOfDays)
          ]);

          return json({ count, daily, timeZone: REPORT_TIME_ZONE });
        }

        if (request.method === 'POST') {
          const countryCode = /^[A-Z]{2}$/.test(request.cf?.country || '')
            ? request.cf.country
            : 'XX';
          return json({ count: await incrementClickCount(env.DB, countryCode) });
        }

        if (request.method === 'DELETE') {
          if (!env.COUNT_ADMIN_KEY) {
            return json({ error: 'Admin key is not configured.' }, { status: 503 });
          }

          if (!hasValidAdminKey(request, env)) {
            return json({ error: 'Invalid admin key.' }, { status: 401 });
          }

          return json(await deleteOldDailyClicks(env.DB));
        }

        return json(
          { error: 'Method not allowed.' },
          { status: 405, headers: { allow: 'GET, POST, DELETE, OPTIONS' } }
        );
      } catch (error) {
        console.error('Claim click API failed:', error);
        return json({ error: `Unable to process claim click request: ${error.message || error}` }, { status: 500 });
      }
    }

    // Static assets & specific known routes
    if (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/data/') ||
      url.pathname === '/sw.js' ||
      url.pathname === '/robots.txt' ||
      url.pathname === '/manifest.webmanifest' ||
      /\.(css|js|json|png|jpg|jpeg|svg|webp|ico|woff2|map)$/i.test(url.pathname)
    ) {
      return env.ASSETS.fetch(request);
    }

    if (
      url.pathname === '/list' || url.pathname === '/list/' || url.pathname === '/list/index.html' ||
      url.pathname === '/count' || url.pathname === '/count/' || url.pathname === '/count/index.html' ||
      url.pathname === '/api-guide' || url.pathname === '/api-guide/' || url.pathname === '/api-guide/index.html' || url.pathname === '/api-guide.html' ||
      url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/index.html' || url.pathname === '/admin.html'
    ) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === '/data-book' || url.pathname === '/data-book/' || url.pathname === '/data-book.html') {
      const dataBookPageUrl = new URL('/data-book.html', url.origin);
      return env.ASSETS.fetch(new Request(dataBookPageUrl, request));
    }

    if (url.pathname === '/404' || url.pathname === '/404.html') {
      return env.ASSETS.fetch(request);
    }

    // Main index page (without ?book= parameter)
    if ((url.pathname === '/' || url.pathname === '/index.html') && !url.searchParams.has('book')) {
      return env.ASSETS.fetch(request);
    }

    // Dynamic Book Pages (e.g. /cambridge-ielts, /book/:slug, /:slug, or ?book=:slug)
    const booksData = await getBooksData(env, url.origin);
    const rawSlug = url.pathname.replace(/^\/book\//, '').replace(/^\//, '').replace(/\/$/, '');
    const isDynamicBookRoute =
      url.pathname.startsWith('/book') ||
      url.searchParams.has('book') ||
      url.searchParams.has('id') ||
      url.searchParams.has('v') ||
      Boolean(booksData && booksData[rawSlug]);

    if (isDynamicBookRoute) {
      const bookKey = extractBookKey(url, booksData);
      const bookHtmlRes = await env.ASSETS.fetch(new Request(new URL('/book.html', url.origin), request));

      if (bookHtmlRes.ok) {
        if (bookKey && booksData && booksData[bookKey]) {
          const book = booksData[bookKey];
          let html = await bookHtmlRes.text();
          const title = book.title ? `${book.title}` : 'Book Details';
          const desc = book.description || 'Open a PDF redirect page with full book details.';
          const img = book.image || '/assets/images/placeholder.svg';
          const canonicalUrl = url.href;

          html = html
            .replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${escapeHtml(title)}</title>`)
            .replace(/<meta name="description" id="metaDescription" content=".*?" \/>/, `<meta name="description" id="metaDescription" content="${escapeHtml(desc)}" />`)
            .replace(/<link rel="canonical" id="canonicalLink" href=".*?" \/>/, `<link rel="canonical" id="canonicalLink" href="${escapeHtml(canonicalUrl)}" />`)
            .replace(/<meta property="og:title" id="ogTitle" content=".*?" \/>/, `<meta property="og:title" id="ogTitle" content="${escapeHtml(title)}" />`)
            .replace(/<meta property="og:description" id="ogDescription" content=".*?" \/>/, `<meta property="og:description" id="ogDescription" content="${escapeHtml(desc)}" />`)
            .replace(/<meta property="og:url" id="ogUrl" content=".*?" \/>/, `<meta property="og:url" id="ogUrl" content="${escapeHtml(canonicalUrl)}" />`)
            .replace(/<meta property="og:image" id="ogImage" content=".*?" \/>/, `<meta property="og:image" id="ogImage" content="${escapeHtml(img)}" />`)
            .replace(/<meta name="twitter:title" id="twitterTitle" content=".*?" \/>/, `<meta name="twitter:title" id="twitterTitle" content="${escapeHtml(title)}" />`)
            .replace(/<meta name="twitter:description" id="twitterDescription" content=".*?" \/>/, `<meta name="twitter:description" id="twitterDescription" content="${escapeHtml(desc)}" />`);

          return new Response(html, {
            headers: {
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
              'pragma': 'no-cache',
              'expires': '0'
            }
          });
        }
        return bookHtmlRes;
      }
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runAutomaticStorageCleanup(env.DB));
  }
};
