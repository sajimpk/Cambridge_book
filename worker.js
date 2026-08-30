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
  return new Response(JSON.stringify(data), { ...init, headers });
}

async function readClickCount(database) {
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/count' || url.pathname === '/count/')) {
      const countPageUrl = new URL('/count/index.html', url.origin);
      return env.ASSETS.fetch(new Request(countPageUrl, request));
    }

    if (url.pathname === '/api/claim-clicks/countries') {
      if (!env.DB) {
        return json({ error: 'Database binding is unavailable.' }, { status: 503 });
      }

      if (request.method !== 'GET') {
        return json({ error: 'Method not allowed.' }, { status: 405, headers: { allow: 'GET' } });
      }

      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) {
        return json({ error: 'Cross-origin request denied.' }, { status: 403 });
      }

      if (!env.COUNT_ADMIN_KEY) {
        return json({ error: 'Admin key is not configured.' }, { status: 503 });
      }

      if (!hasValidAdminKey(request, env)) {
        return json({ error: 'Invalid admin key.' }, { status: 401 });
      }

      const clickDate = url.searchParams.get('date') || '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(clickDate)) {
        return json({ error: 'A valid date is required.' }, { status: 400 });
      }

      try {
        return json({
          date: clickDate,
          countries: await readCountryClicks(env.DB, clickDate)
        });
      } catch (error) {
        console.error('Country click report failed:', error);
        return json({ error: 'Unable to load country click data.' }, { status: 500 });
      }
    }

    if (url.pathname === '/api/claim-clicks') {
      if (!env.DB) {
        return json({ error: 'Database binding is unavailable.' }, { status: 503 });
      }

      try {
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
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) {
            return json({ error: 'Cross-origin request denied.' }, { status: 403 });
          }

          const countryCode = /^[A-Z]{2}$/.test(request.cf?.country || '')
            ? request.cf.country
            : 'XX';
          return json({ count: await incrementClickCount(env.DB, countryCode) });
        }

        if (request.method === 'DELETE') {
          const origin = request.headers.get('origin');
          if (origin && origin !== url.origin) {
            return json({ error: 'Cross-origin request denied.' }, { status: 403 });
          }

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
          { status: 405, headers: { allow: 'GET, POST, DELETE' } }
        );
      } catch (error) {
        console.error('Claim click API failed:', error);
        return json({ error: 'Unable to update the click count.' }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runAutomaticStorageCleanup(env.DB));
  }
};
