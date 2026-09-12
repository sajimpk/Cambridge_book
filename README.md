# Book Library

A searchable PDF-book directory built with HTML, CSS, vanilla JavaScript, Cloudflare Workers, Static Assets, and D1.

The site uses one shared dynamic book page for all books. It also records offer-button clicks in D1 and provides a day-wise report at `/count`.

## Main features

- Instant book search
- One dynamic details page for every book
- External download/redirect links from JSON
- Responsive light and dark UI
- Local favorites, recently viewed books, and view counters
- Localized offer, currency, and countdown components
- Cloudflare Worker API
- D1-backed offer click tracking
- Day-wise click report using Bangladesh time
- Admin-key-protected country breakdown for each date
- Admin-protected deletion of daily records older than seven days
- Weekly storage check with automatic cleanup at 100 MiB

## Project structure

```text
.
|-- index.html                   # Main searchable book page
|-- book.html                    # Source template for the book details page
|-- book/index.html              # Generated shared book details page
|-- count/index.html             # Day-wise click report
|-- 404.html                     # Not-found page
|-- data/book.json               # Source of truth for book information
|-- assets/css/styles.css        # Site styles
|-- assets/js/index.js           # Book search and cards
|-- assets/js/book.js            # Dynamic book details
|-- assets/js/claim-counter.js   # Claim-button click tracking
|-- assets/js/count.js           # Click report UI
|-- worker.js                    # API routes and static-asset fallback
|-- schema.sql                   # D1 database schema
|-- wrangler.jsonc               # Cloudflare Worker, assets, and D1 config
|-- sw.js                        # Service worker
`-- generate.js                  # Regenerates the shared book page
```

## Book data and URLs

All books are stored in `data/book.json`. The object key becomes the book identifier.

```json
{
  "cambridge-ielts-01": {
    "title": "Cambridge IELTS 1",
    "description": "Book description",
    "category": "IELTS",
    "image": "https://example.com/cover.jpg",
    "download": "https://example.com/download"
  }
}
```

The corresponding details URL uses an obfuscated, unique token:

```text
/book/?book=<encoded_token>
```

The frontend reads the key from the `book` query parameter, finds the matching entry in `data/book.json`, and assigns its `download` value to the download buttons.

### Add a book

1. Open `data/book.json`.
2. Add a unique object key and the required fields.
3. Keep the JSON valid, including commas between entries.
4. Deploy the project. No separate HTML page is required for each book.

## Click tracking

The `.global-offer__button` keeps its existing link/action. On click, `assets/js/claim-counter.js` also sends a background request to:

```http
POST /api/claim-clicks
```

The Worker increments:

- `click_stats`: all-time total
- `daily_clicks`: total for the current Bangladesh date

No count is displayed inside the claim button.

## Click report

Open:

```text
https://books.<your-subdomain>.workers.dev/count
```

The report shows:

- All-time clicks
- Today's clicks
- Day-wise click totals
- Country-wise totals after clicking a date and entering `COUNT_ADMIN_KEY`

Daily boundaries use `Asia/Dhaka` time.

Country data comes from Cloudflare's request metadata and is stored in `daily_country_clicks`. Country tracking starts only after the country-tracking version is deployed; older aggregate rows cannot be reconstructed by country. The centered country dialog shows eight countries per page and provides Previous/Next pagination when needed.

### Delete old daily data

The report includes **Delete data older than 7 days**. It deletes only rows outside the most recent seven calendar dates. Today and the previous six dates remain untouched.

Deletion requires the `COUNT_ADMIN_KEY` Worker secret. The key is requested by the browser only when an administrator uses the delete button; it is not stored in frontend code.

The all-time total in `click_stats` is retained when old daily rows are deleted.

### Automatic storage cleanup

A Cron Trigger runs once per week on Sunday at `11:59 PM Asia/Dhaka` (`17:59 UTC`) and reads D1's actual `meta.size_after` value. When the database size is at least `100 MiB` (`104,857,600` bytes), the Worker automatically removes rows older than the protected seven-day cutoff from both `daily_clicks` and `daily_country_clicks`.

Automatic cleanup does not delete:

- Today's daily data
- The previous six calendar dates (seven dates total including today)
- The all-time total in `click_stats`

If the database is below the threshold, the scheduled job performs no deletion. Cron schedules use UTC, but the retention cutoff is calculated with `Asia/Dhaka` dates.

## API

### Read the report

```http
GET /api/claim-clicks?days=365
```

Example response:

```json
{
  "count": 120,
  "daily": [
    {
      "click_date": "2026-08-27",
      "total_clicks": 15
    }
  ],
  "timeZone": "Asia/Dhaka"
}
```

The `days` value is limited to `1` through `365`.

### Record a click

```http
POST /api/claim-clicks
```

### Delete daily records older than seven days

```http
DELETE /api/claim-clicks
X-Admin-Key: YOUR_ADMIN_KEY
```

This endpoint rejects cross-origin browser requests and requests without the configured admin key.

### Read a date's country breakdown

```http
GET /api/claim-clicks/countries?date=2026-08-27
X-Admin-Key: sajimpk
```

Country-level data is never included in the public report endpoint.

## D1 setup

To set up the Cloudflare D1 database for click tracking:

### 1. Create the D1 database

Run the following command to create a new D1 database named `clickcount`:

```powershell
npx wrangler@latest d1 create clickcount
```

Wrangler will output the configuration details for your database, including its unique `database_id`.

### 2. Configure bindings in wrangler.jsonc

Open `wrangler.jsonc` and update the `d1_databases` array with your database information:

```json
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "clickcount",
      "database_id": "<database_id>"
    }
  ]
```

### 3. Initialize the schema

Apply the database schema from `schema.sql` to initialize the tables:

#### For local development:

```powershell
npx wrangler@latest d1 execute clickcount --local --file=./schema.sql
```

#### For production (remote):

```powershell
npx wrangler@latest d1 execute clickcount --remote --file=./schema.sql
```

The schema uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE`, so it is safe to rerun these commands when updating the schema or restarting local development.

## Configure the deletion secret

Set a strong secret before using the delete option:

```powershell
npx wrangler@latest secret put COUNT_ADMIN_KEY
```

Enter the secret when Wrangler prompts for it. Do not put this value in `wrangler.jsonc`, JavaScript, Git, or this README.

Example format only (do not use this value as the live secret):

```text
example-delete-admin-key
```

When the `/count` page asks for the admin key, enter the private value that was configured with `wrangler secret put`. Keep the real value in a password manager, not in the repository.

For local development, place the value in an uncommitted `.dev.vars` file:

```dotenv
COUNT_ADMIN_KEY=replace-with-a-private-local-value
```

## Local development

Requirements:

- Node.js
- A Cloudflare account for remote D1 and deployment

After initializing the local D1 schema, start Wrangler:

```powershell
npx wrangler@latest dev
```

Wrangler serves the static assets, runs `worker.js`, and provides the local D1 binding.

## Deployment

Deploy the Worker, static assets, and bindings together:

```powershell
npx wrangler@latest deploy
```

The deployment output should list both bindings:

```text
env.DB      D1 Database
env.ASSETS  Assets
```

The deployment also installs the weekly Sunday-night Cron Trigger from `wrangler.jsonc`. Cloudflare may take several minutes to propagate a new or changed Cron Trigger.

After deployment, verify:

```text
https://books.<your-subdomain>.workers.dev/
https://books.<your-subdomain>.workers.dev/api/claim-clicks
https://books.<your-subdomain>.workers.dev/count
```

If a browser still shows an older cached page, use a hard refresh (`Ctrl + Shift + R`). API requests bypass the service-worker cache.

## Regenerate the shared book page

When `book.html` changes, regenerate `book/index.html` with:

```powershell
node generate.js
```

Review the generated changes before deployment.

## External Website API & Instant 1.5s Expiry Token Engine

You can easily connect other websites (WordPress, Blogger, React, Vue, PHP, or HTML) to this system. Every link request generates a brand new cryptographic token that strictly expires in **1.5 seconds (1500 ms)**. If any expired or reused link is visited, the server immediately returns **404**.

### 1. API Endpoints

All API endpoints support CORS and require authentication using the API key via `x-api-key` header or `?key=` query parameter.

#### Available Endpoints

#### A. Get all `data_book` attributes ONLY
```http
GET /api/data-books?key=sajimpk
```
**Response:**
```json
[
  "cambridge-ielts-01",
  "cambridge-ielts-02",
  "cambridge-ielts-03",
  "cambridge-ielts-04",
  "cambridge-ielts-05",
  "cambridge-ielts-06",
  "cambridge-ielts-07",
  "cambridge-ielts-08",
  "cambridge-ielts-09",
  "cambridge-ielts-10",
  "mindset-for-ielts-1-students-book",
  "the-official-cambridge-guide-to-ielts"
]
```

#### B. Resolve single live book link (1.5s validity)
```http
GET /api/books/resolve?id=cambridge-ielts-01&key=sajimpk
```

> **🌐 Visual Directory:** You can also open `/data-book` in your browser (`http://127.0.0.1:8000/data-book`) to view a searchable visual table and copy any `data-book` tag with 1 click!

### 2. Instant Auto-Linker Script (Zero-Config Domain Support)

The embed script **automatically detects its own domain** from the `src` attribute. When you change your domain in the future, you simply update the `src` URL — no extra configuration or `data-api-url` required!

Place this script tag on your external website (e.g., in header or before `</body>`):

```html
<!-- Simple setup: Automatically detects domain from src -->
<script src="https://your-domain.com/assets/js/embed.js" data-api-key="sajimpk" defer></script>
```

> **💡 Domain Change Flexibility**:
> - If your domain is `https://books.example.workers.dev`, use `src="https://books.example.workers.dev/assets/js/embed.js"`.
> - If you change your domain to `https://mycustomlibrary.com`, simply change to `src="https://mycustomlibrary.com/assets/js/embed.js"`.
> - The script automatically routes all book clicks to the new domain!
> - *(Optional)* You can also explicitly pass `data-api-url="https://your-domain.com"` if you ever want to override it.

Then in your external website content, simply write HTML links with `data-book="<book-id>"`:

```html
<!-- The script automatically generates a fresh 1.5s token at the moment of click/interaction -->
<a data-book="cambridge-ielts-01">Download Cambridge IELTS 1</a>
<a data-book="cambridge-ielts-16">Download Cambridge IELTS 16</a>
```

### 3. Strict 1.5-Second Expiration & 404 Protection

- **Per-Click Instant Hash**: Every click generates a fresh token with millisecond precision timestamp.
- **Immediate Navigation (0–300ms)**: The browser opens the link immediately.
- **Copy/Reuse Protection (> 1.5s)**: If anyone attempts to copy the URL, share it, or revisit it after 1.5 seconds, the token fails cryptographic validation and immediately returns **404 Not Found**.

### 4. Static Demo Site

A full interactive demonstration is included in `demo-site/index.html`:
- Open `http://127.0.0.1:8000/demo-site/` or deploy `demo-site/` to any static hosting provider.
- Includes a live test button **"Test Expired Link (>1.5s) ➔ 404"** to verify the expiration behavior.

### 4. Fetch from External Backend (Node.js / PHP / Python)

**JavaScript / Node.js:**
```javascript
const response = await fetch('https://books.<your-subdomain>.workers.dev/api/books', {
  headers: { 'x-api-key': 'sajimpk' }
});
const data = await response.json();
console.log(data.books['cambridge-ielts-01'].url);
```

**PHP (WordPress):**
```php
$response = wp_remote_get('https://books.<your-subdomain>.workers.dev/api/books?key=sajimpk');
$data = json_decode(wp_remote_retrieve_body($response), true);
$cambridge1_url = $data['books']['cambridge-ielts-01']['url'];
```

## Security notes

- Keep `COUNT_ADMIN_KEY` and `API_KEY` secure.
- D1 database IDs are configuration identifiers, not passwords; account credentials and API tokens must still remain private.
- The `/count` page is marked `noindex`, but anyone who knows the URL can view aggregate counts.
- Only the delete operation is protected by the admin secret.
- Public click endpoints can receive automated traffic; use Cloudflare rate limiting or Turnstile if abuse becomes a problem.
