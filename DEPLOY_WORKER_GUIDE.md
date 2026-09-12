# 🚀 Cloudflare Worker Deployment Guide

এই গাইডে প্রজেক্টটি Cloudflare Workers-এ ডিপ্লয় করার সম্পূর্ণ ধাপ সহজভাবে ব্যাখ্যা করা হয়েছে।

---

## 📋 সূচিপত্র (Table of Contents)
1. [প্রয়োজনীয় রিকোয়ারমেন্টস (Prerequisites)](#1-প্রয়োজনীয়-রিকোয়ারমেন্টস-prerequisites)
2. [Wrangler CLI লগইন ও সেটআপ](#2-wrangler-cli-লগইন-ও-সেটআপ)
3. [Cloudflare D1 ডেটাবেজ তৈরি ও স্কিমা মাইগ্রেশন](#3-cloudflare-d1-ডেটাবেজ-তৈরি-ও-স্কিমা-মাইগ্রেশন)
4. [wrangler.jsonc কনফিগারেশন](#4-wranglerjsonc-কনফিগারেশন)
5. [এনভায়রনমেন্ট ভ্যারিয়েবল (Secrets & Variables) সেটআপ](#5-এনভায়রনমেন্ট-ভ্যারিয়েবল-secrets--variables-সেটআপ)
6. [প্রজেক্ট ডিপ্লয়মেন্ট (Deploy)](#6-প্রজেক্ট-ডিপ্লয়মেন্ট-deploy)
7. [কাস্টম ডোমেইন সেটআপ (Custom Domain)](#7-কাস্টম-ডোমেইন-সেটআপ-custom-domain)
8. [লাইভ লগ চেক ও ট্রাবলশুটিং](#8-লাইভ-লগ-চেক-ও-ট্রাবলশুটিং)

---

## 1. প্রয়োজনীয় রিকোয়ারমেন্টস (Prerequisites)
- [Node.js](https://nodejs.org/) (v18 বা তার পরবর্তী ভার্সন)
- একটি [Cloudflare Account](https://dash.cloudflare.com/)
- টার্মিনাল বা কমান্ড প্রম্পট (PowerShell / Bash)

---

## 2. Wrangler CLI লগইন ও সেটআপ

প্রথমে প্রজেক্ট ফোল্ডারে টার্মিনাল ওপেন করুন এবং Cloudflare অ্যাকাউন্টে লগইন করুন:

```bash
# Cloudflare অ্যাকাউন্টে লগইন করুন
npx wrangler login
```
ব্রাউজারে একটি অথেনটিকেশন পেজ ওপেন হবে, **"Allow"** বাটনে ক্লিক করে লগইন সম্পন্ন করুন।

যাচাই করতে রান করুন:
```bash
npx wrangler whoami
```

---

## 3. Cloudflare D1 ডেটাবেজ তৈরি ও স্কিমা মাইগ্রেশন

ক্লিক ট্র্যাকিং ও অ্যানালিটিক্স সংরক্ষণের জন্য Cloudflare D1 ডেটাবেজ প্রয়োজন।

### ধাপ ১: ডেটাবেজ তৈরি করুন
```bash
npx wrangler d1 create clickcount
```

টার্মিনালে এমন একটি আউটপুট আসবে:
```json
{
  "binding": "DB",
  "database_name": "clickcount",
  "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```
> 💡 **নোট:** এই `database_id` কপি করে রাখুন।

### ধাপ ২: স্কিমা মাইগ্রেশন রান করুন
ডেটাবেজের টেবিলগুলো (`click_stats`, `daily_clicks`, `daily_country_clicks`) তৈরি করতে `schema.sql` ফাইলটি এক্সিকিউট করুন:

```bash
# রিমোট ক্লাউডফ্লেয়ার ডেটাবেজে রান করুন:
npx wrangler d1 execute clickcount --remote --file=./schema.sql
```

লোকালে টেস্ট করার জন্য:
```bash
npx wrangler d1 execute clickcount --local --file=./schema.sql
```

---

## 4. wrangler.jsonc কনফিগারেশন

আপনার প্রজেক্টের রুট ডিরেক্টরিতে থাকা `wrangler.jsonc` ফাইলটি ওপেন করুন এবং আপনার `database_id` আপডেট করুন:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "books",
  "main": "worker.js",
  "compatibility_date": "2026-08-26",
  "vars": {
    "COUNT_ADMIN_KEY": "sajimpk",
    "API_KEY": "sajimpk"
  },
  "assets": {
    "directory": ".",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "clickcount",
      "database_id": "আপনার-D1-DATABASE-ID-এখানে-দিন"
    }
  ],
  "triggers": {
    "crons": [
      "59 17 * * 1"
    ]
  }
}
```

---

## 5. এনভায়রনমেন্ট ভ্যারিয়েবল (Secrets & Variables) সেটআপ

সিকিউরিটির জন্য প্রোডাকশনে API কী সিক্রেট হিসেবে যোগ করতে পারেন:

```bash
# API Key সেট করুন:
npx wrangler secret put API_KEY
sajimpk@api

# Admin Key সেট করুন:
npx wrangler secret put COUNT_ADMIN_KEY
sajimAdmin
```
*(টার্মিনালে প্রম্পট আসলে আপনার পাসওয়ার্ড/কী টাইপ করে এন্টার চাপুন)*

---

## 6. প্রজেক্ট ডিপ্লয়মেন্ট (Deploy)

সব কনফিগারেশন শেষ হলে Worker ডিপ্লয় করুন:

```bash
npx wrangler deploy
```

সফলভাবে ডিপ্লয় হলে আপনি আপনার Worker-এর লাইভ URL পেয়ে যাবেন:
```text
Uploaded books (x.xx sec)
Deployed books triggers (x.xx sec)
  https://books.<your-subdomain>.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 7. কাস্টম ডোমেইন সেটআপ (Custom Domain)

যদি আপনার নিজস্ব ডোমেইন (যেমন: `books.yourdomain.com` বা `yourdomain.com`) থাকে:

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) এ যান।
2. **Workers & Pages** > **books** এ ক্লিক করুন।
3. **Settings** ট্যাবে যান > **Domains & Routes** এ ক্লিক করুন।
4. **Add** > **Custom Domain** নির্বাচন করুন।
5. আপনার কাঙ্ক্ষিত ডোমেইন (e.g. `library.mysite.com`) লিখে **Add Custom Domain** এ ক্লিক করুন।
6. Cloudflare স্বয়ংক্রিয়ভাবে SSL সার্টিফিকেট ইস্যু করে ডোমেইনটি কানেক্ট করে দেবে।

---

## 8. লাইভ লগ চেক ও ট্রাবলশুটিং

### লাইভ রিকোয়েস্ট লগ দেখা (Realtime Tail):
```bash
npx wrangler tail
```

### লোকাল ডেভেলপমেন্ট টেস্ট সার্ভার:
```bash
# Wrangler Dev Server:
npx wrangler dev

# অথবা Node.js Dev Server:
node dev-server.js
```

### কমন ইরর ফিক্স:
| সমস্যা | সমাধান |
|---|---|
| `D1_ERROR: no such table` | `npx wrangler d1 execute clickcount --remote --file=./schema.sql` রান করুন। |
| `Unauthorized: 401` | `API_KEY` ঠিকমতো সেট করা হয়েছে কিনা চেক করুন (`wrangler.jsonc` অথবা `wrangler secret put API_KEY`)। |
| `Asset binding error` | `wrangler.jsonc`-এ `"assets": { "directory": ".", "binding": "ASSETS" }` ঠিক আছে কিনা দেখুন। |
