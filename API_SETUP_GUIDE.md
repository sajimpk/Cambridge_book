# ⚡ API Setup & Integration Guide

এই গাইডে প্রজেক্টের সমস্ত API এন্ডপয়েন্ট, অথেনটিকেশন, ডাইনামিক লিঙ্ক জেনারেশন এবং বাহ্যিক ওয়েবসাইটে ইন্টিগ্রেশনের সম্পূর্ণ নিয়ম দেওয়া হলো।

---

## 🔑 অথেনটিকেশন (Authentication)

সুরক্ষিত API এন্ডপয়েন্টগুলো অ্যাক্সেস করতে API Key প্রদান করা বাধ্যতামূলক।

API Key পাঠানোর দুটি পদ্ধতি রয়েছে:

1. **HTTP Header (উত্তম পদ্ধতি):**
   ```http
   x-api-key: sajimpk
   ```
   *অথবা Authorization Header:*
   ```http
   Authorization: Bearer sajimpk
   ```

2. **Query Parameter (সহজ পদ্ধতি):**
   ```text
   ?key=sajimpk
   # অথবা
   ?api_key=sajimpk
   ```

---

## 📡 API এন্ডপয়েন্ট রেফারেন্স (API Endpoints)

### ১. সব Data Books আইডি লিস্ট পাওয়া (`/api/data-books`)
এই এন্ডপয়েন্টটি সমস্ত বইয়ের কী/আইডিগুলোর একটি ক্লিন অ্যারে রিটার্ন করে।

- **পদ্ধতি (Method):** `GET`
- **URL:** `/api/data-books?key=YOUR_API_KEY`
- **বিকল্প পাথসমূহ:** `/api/data-book`, `/api/tags`

#### cURL উদাহরণ:
```bash
curl -X GET "https://your-worker.workers.dev/api/data-books" \
  -H "x-api-key: sajimpk"
```

#### Response Example:
```json
[
  "cambridge-ielts-1-academic",
  "cambridge-ielts-2-academic",
  "cambridge-ielts-3-academic",
  "cambridge-ielts-19-academic",
  "ielts-trainer-1",
  "official-cambridge-guide-to-ielts"
]
```

---

### ২. ডাইনামিক ১.৫ সেকেন্ড টোকেন ও লিঙ্ক তৈরি (`/api/books/resolve`)
যেকোনো নির্দিষ্ট বইয়ের নাম বা আইডি পাঠালে এটি বুক ডিটেইলস এবং ক্ষণস্থায়ী ডাইনামিক রিডাইরেক্ট লিঙ্ক রিটার্ন করে।

- **পদ্ধতি (Method):** `GET` অথবা `POST`
- **URL:** `/api/books/resolve?id=cambridge-ielts-19-academic&key=YOUR_API_KEY`
- **বিকল্প পাথ:** `/api/book-link`
- **কাস্টম সাইট URL প্যারামিটার (Optional):** `?site_url=https://site.com` অথবা `?base_url=https://site.com` *(ব্রাউজার থেকে কল করলে `Origin` / `Referer` হেডার দেখে স্বয়ংক্রিয়ভাবে আপনার সাইট ডিটেক্ট করে নেবে)*

#### GET Request (cURL):
```bash
curl -X GET "https://your-worker.workers.dev/api/books/resolve?id=cambridge-ielts-19-academic&site_url=https://site.com" \
  -H "x-api-key: sajimpk"
```

#### POST Request (JSON):
```bash
curl -X POST "https://your-worker.workers.dev/api/books/resolve" \
  -H "Content-Type: application/json" \
  -H "x-api-key: sajimpk" \
  -d '{
    "id": "cambridge-ielts-19-academic",
    "site_url": "https://site.com"
  }'
```

#### Response Example:
```json
{
  "success": true,
  "id": "cambridge-ielts-19-academic",
  "title": "Cambridge IELTS 19 Academic",
  "category": "Cambridge Academic",
  "token": "mty8m2xy.KCMoHgUHBX92J2RhU0JaDWtjKX0kFAk",
  "url": "https://site.com/book/?book=mty8m2xy.KCMoHgUHBX92J2RhU0JaDWtjKX0kFAk",
  "path": "/book/?book=mty8m2xy.KCMoHgUHBX92J2RhU0JaDWtjKX0kFAk",
  "relative_url": "/book/?book=mty8m2xy.KCMoHgUHBX92J2RhU0JaDWtjKX0kFAk"
}
```
> ⏱️ **নোট:** 
> 1. আপনার সাইট (`site.com`) থেকে API কল করলে রিটার্ন করা `url` স্বয়ংক্রিয়ভাবে `https://site.com/book/?book=...` আকারে আসবে (worker ডোমেইন নয়)।
> 2. নিরাপত্তা ও কপিরাইট সুরক্ষার জন্য জেনারেট করা ডাইনামিক লিঙ্কটি সর্বোচ্চ **১.৫ সেকেন্ড** কার্যকর থাকে। এর পর লিঙ্কটি স্বয়ংক্রিয়ভাবে `404 Link Not Found` পেজে পাঠাবে।

---

### ৩. ক্লিক ট্র্যাকিং ও অ্যানালিটিক্স API (`/api/claim-clicks`)

- **GET `/api/claim-clicks?days=30`**: বিগত ৩০ দিনের ক্লিক রিপোর্ট।
- **POST `/api/claim-clicks`**: অফার ক্লেইম ক্লিক কাউন্ট বাড়ানো।
- **DELETE `/api/claim-clicks`**: পুরোনো ডাটা ক্লিন করা (Admin Key প্রয়োজন)।

#### Admin Header:
```http
x-admin-key: sajimpk
```

---

## 🌐 বাহ্যিক ওয়েবসাইটে ইন্টিগ্রেশন (External Site Integration)

যেকোনো ওয়েবসাইটে বই পড়ার ডাইনামিক লিঙ্ক সহজে যুক্ত করার দুটি নিয়ম রয়েছে:

### পদ্ধতি ১: অটোমেটিক Embed Script (সবচেয়ে সহজ)
আপনার ওয়েবসাইটের HTML পেজে নিচের স্ক্রিপ্টটি যুক্ত করুন:

```html
<!-- HTML এ বাটন বা লিঙ্ক যোগ করুন -->
<a href="#" class="read-btn" data-book="cambridge-ielts-19-academic">
  📖 Read Book Online
</a>

<!-- Embed Script যুক্ত করুন (এটি স্বয়ংক্রিয়ভাবে আপনার সাইটের https://site.com/book/ লিঙ্ক তৈরি করবে) -->
<script src="https://your-worker.workers.dev/api/embed.js"></script>
```
*এই স্ক্রিপ্টটি আপনার নিজের সাইটের ডোমেইনে (`site.com/book/`) ক্লিক করার মুহূর্তে ১.৫ সেকেন্ডের ডাইনামিক এনক্রিপ্টেড টোকেন তৈরি করে সুরক্ষিতভাবে ওপেন করবে।*

---

### পদ্ধতি ২: JavaScript Fetch দিয়ে ম্যানুয়াল কল
```javascript
async function openSecureBook(bookId) {
  try {
    const response = await fetch(`https://your-worker.workers.dev/api/books/resolve?id=${encodeURIComponent(bookId)}`, {
      headers: {
        'x-api-key': 'sajimpk'
      }
    });

    const data = await response.json();
    if (data.success && data.url) {
      window.location.href = data.url; // ওপেন করুন
    } else {
      alert('বইটি পাওয়া যায়নি।');
    }
  } catch (error) {
    console.error('Error opening book:', error);
  }
}

// ব্যবহার:
// openSecureBook('cambridge-ielts-19-academic');
```

---

## 🔒 সিকিউরিটি নিয়মাবলী (Security Guidelines)
1. **API Key গোপন রাখুন**: পাবলিক ফ্রন্ট-এন্ডে সরাসরি মাস্টার অ্যাডমিন কী প্রকাশ করবেন না।
2. **Strict Expiration**: টোকেন জেনারেশনের সময় ও ব্রাউজারে খোলার সময়ের ব্যবধান ১.৫ সেকেন্ডের বেশি হলে লিঙ্ক এক্সপায়ার হবে।
3. **No Caching**: ক্লাউডফ্লেয়ার ও ব্রাউজারে `Cache-Control: no-store` হেডার সবসময় একটিভ রাখা আছে।
