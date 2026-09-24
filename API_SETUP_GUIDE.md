# ⚡ API Setup & Third-Party Integration Guide

এই গাইডে প্রজেক্টের সমস্ত API এন্ডপয়েন্ট, **API Key সিকিউরিটি**, ডাইনামিক ১.৫ সেকেন্ড টোকেন জেনারেশন এবং **থার্ড-পার্টি ওয়েবসাইটে (`theirsite/book/...`) যুক্ত করার সম্পূর্ণ নিয়মাবলী** দেওয়া হলো।

---

## 🔒 API Key সিকিউরিটি ও নীতিমালা

> [!IMPORTANT]
> **API Key ছাড়া কোনো থার্ড-পার্টি ওয়েবসাইট এই সার্ভিসের কোনো বই, লিঙ্ক বা স্ক্রিপ্ট ব্যবহার করতে পারবে না।**
> API Key ছাড়া রিকোয়েস্ট পাঠালে সার্ভার থেকে `401 Unauthorized` রিটার্ন করা হবে।

### API Key পাঠানোর ৩টি উপায়:
1. **Script Tag URL ও Attribute (থার্ড-পার্টি সাইটের জন্য সবচেয়ে সহজ):**
   ```html
   <script src="https://your-worker.workers.dev/api/embed.js?key=YOUR_API_KEY" data-api-key="YOUR_API_KEY" defer></script>
   ```
2. **HTTP Header (সার্ভার বা API কলের জন্য):**
   ```http
   x-api-key: YOUR_API_KEY
   ```
   *অথবা:*
   ```http
   Authorization: Bearer YOUR_API_KEY
   ```
3. **Query Parameter:**
   ```text
   ?key=YOUR_API_KEY
   # অথবা
   ?api_key=YOUR_API_KEY
   ```

---

## 🌐 থার্ড-পার্টি ওয়েবসাইটে যুক্ত করার নিয়ম

আমাদের Embed ইঞ্জিন দুটি সুবিধাজনক মোডে কাজ করে:
1. **API Key দিলে:** থার্ড-পার্টি সাইটের নিজস্ব ডোমেইনে (`theirsite.com/book/?book=...`) বইয়ের লিংক ওপেন হবে।
2. **API Key না দিলে:** লিংক স্বয়ংক্রিয়ভাবে আপনার **মূল API ডোমেইনে (`https://books.sajim-arifacademy.workers.dev/book/?book=...`)** রিডাইরেক্ট হয়ে বইয়ের লাইব্রেরি ওপেন করবে।

---

### মোড ১: API Key ছাড়া (সরাসরি API ডোমেইনে Redirect)
থার্ড-পার্টি সাইটে আলাদা কোনো `/book/` পেজ বানানোর প্রয়োজন নেই। যেকোনো লিঙ্কে ক্লিক করলে ব্যবহারকারী সরাসরি মূল API ডোমেইনে গিয়ে বইটি পড়বে:

```html
<!-- ১. পেজের বাটন বা লিংক -->
<a href="#" class="btn" data-book="cambridge-ielts-19">
  📖 Read Cambridge IELTS 19
</a>

<!-- ২. স্ক্রিপ্ট ট্যাগ (কোনো API Key ছাড়াই কাজ করবে) -->
<script 
  src="https://books.sajim-arifacademy.workers.dev/api/embed.js" 
  defer
></script>
```
> 🎯 **কী ঘটবে?**  
> ব্যবহারকারী লিংকে ক্লিক করামাত্র মূল ডোমেইনে রিডাইরেক্ট হবে:  
> `https://books.sajim-arifacademy.workers.dev/book/?book=TOKEN`

---

### মোড ২: API Key সহ (নিজস্ব সাইটের ডোমেইনে: `theirsite.com/book/`)
পার্টনার সাইট যদি তাদের নিজস্ব ডোমেইনে ব্র্যান্ডেড রিডার রাখতে চায়:

#### ধাপ ১: তাদের সাইটের পেজে বাটন ও স্ক্রিপ্ট ট্যাগ (API Key সহ)
```html
<a href="#" class="btn" data-book="cambridge-ielts-19">
  📖 Read Cambridge IELTS 19
</a>

<script 
  src="https://books.sajim-arifacademy.workers.dev/api/embed.js" 
  data-api-key="YOUR_API_KEY" 
  defer
></script>
```
> 🎯 **কী ঘটবে?**  
> API Key থাকার কারণে লিংক স্বয়ংক্রিয়ভাবে তাদের নিজস্ব ডোমেইনে পয়েন্ট করবে:  
> `https://theirsite.com/book/?book=TOKEN`

#### ধাপ ২: পার্টনার সাইটে নিজস্ব রিডার পেজ তৈরি (`theirsite.com/book/index.html`)
পার্টনার সাইটের `book/index.html` ফাইলে নিচের কোডটুকু বসিয়ে দিলেই অটোমেটিক ফুল রিডার চালু হয়ে যাবে:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IELTS Book Reader</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 2rem 1rem;">
  
  <!-- ১. রিডার কন্টেইনার -->
  <div id="book-reader-container"></div>

  <!-- ২. Embed Script (API Key সহ) -->
  <script 
    src="https://books.sajim-arifacademy.workers.dev/api/embed.js" 
    data-api-key="YOUR_API_KEY" 
    defer
  ></script>

</body>
</html>
```

*এই স্ক্রিপ্টটি URL থেকে ১.৫ সেকেন্ডের টোকেনটি নিয়ে আমাদের সিকিউর API থেকে বইয়ের টাইটেল, কভার ইমেজ, ডেসক্রিপশন এবং অনলাইন রিডিং/ডাউনলোড বাটন স্বয়ংক্রিয়ভাবে রেন্ডার করবে।*

---

## 📡 সার্ভার-টু-সার্ভার API এন্ডপয়েন্টস

### ১. সব বইয়ের আইডি লিস্ট পাওয়া (`/api/data-books`)
- **পদ্ধতি (Method):** `GET`
- **URL:** `/api/data-books?key=YOUR_API_KEY`
- **বিকল্প পাথ:** `/api/data-book`, `/api/tags`

```bash
curl -X GET "https://your-worker.workers.dev/api/data-books" \
  -H "x-api-key: YOUR_API_KEY"
```

#### Response:
```json
[
  "cambridge-ielts-01",
  "cambridge-ielts-02",
  "cambridge-ielts-18",
  "cambridge-ielts-19"
]
```

---

### ২. ডাইনামিক লিঙ্ক রেজল্যুশন API (`/api/books/resolve`)
থার্ড-পার্টি সাইট তাদের ব্যাকএন্ড থেকে কল করে সরাসরি তাদের সাইটের কাস্টম ফরম্যাটেড লিঙ্ক পেতে পারে:

- **পদ্ধতি (Method):** `GET` অথবা `POST`
- **URL:** `/api/books/resolve?id=cambridge-ielts-19&key=YOUR_API_KEY&site_url=https://theirsite.com`
- **বিকল্প পাথ:** `/api/book-link`

```bash
curl -X GET "https://your-worker.workers.dev/api/books/resolve?id=cambridge-ielts-19&key=YOUR_API_KEY&site_url=https://theirsite.com"
```

#### Response:
```json
{
  "success": true,
  "id": "cambridge-ielts-19",
  "title": "Cambridge IELTS 19",
  "category": "IELTS",
  "token": "mtybxtkp.QUQxNTwoHBQPQA16en1zFgMMUEQnPQ",
  "url": "https://theirsite.com/book/?book=mtybxtkp.QUQxNTwoHBQPQA16en1zFgMMUEQnPQ",
  "path": "/book/?book=mtybxtkp.QUQxNTwoHBQPQA16en1zFgMMUEQnPQ",
  "relative_url": "/book/?book=mtybxtkp.QUQxNTwoHBQPQA16en1zFgMMUEQnPQ"
}
```

---

### ৩. একক বইয়ের ডিটেইলস API (`/api/book-info`)
বইয়ের পূর্ণাঙ্গ তথ্য ও ডাউনলোড লিঙ্ক পাওয়ার জন্য:

- **পদ্ধতি (Method):** `GET`
- **URL:** `/api/book-info?id=cambridge-ielts-19&key=YOUR_API_KEY`
- **বিকল্প পাথ:** `/api/book-details`

```bash
curl -X GET "https://your-worker.workers.dev/api/book-info?id=cambridge-ielts-19&key=YOUR_API_KEY"
```

#### Response:
```json
{
  "success": true,
  "id": "cambridge-ielts-19",
  "title": "Cambridge IELTS 19",
  "description": "Official Cambridge IELTS 19 Practice Tests...",
  "category": "IELTS",
  "image": "https://www.ieltsbuddy.com/images/cambridge-ielts-books.jpg",
  "download": "http://sharelink.ng/sM2c"
}
```

---

## ⚙️ নিরাপত্তা ও টোকেন এক্সপাইরি নীতি
1. **১.৫ সেকেন্ড কঠোর এক্সপায়ারি (1.5s Strict Expiry):** লিংক বা টোকেন তৈরি হওয়ার ১.৫ সেকেন্ডের মধ্যে ব্রাউজারে ভ্যালিডেশন হতে হবে। মেয়াদোত্তীর্ণ বা রিউজ লিঙ্ক সরাসরি `404 Link Expired` পেজে রিডাইরেক্ট হবে।
2. **API Key সিকিউরিটি:** অনুমোদিত API Key ব্যতীত যেকোনো থার্ড-পার্টি স্ক্রিপ্ট লোড ও ডাটা রিকোয়েস্ট ব্লক থাকবে।
3. **No-Cache সুরক্ষা:** সমস্ত রেসপন্সে `Cache-Control: no-store, no-cache, must-revalidate` সক্রিয় থাকবে।
