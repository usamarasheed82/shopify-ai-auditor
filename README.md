# AI Readiness Auditor — Shopify App

A Shopify embedded app that audits stores for AI/LLM readiness across 5 dimensions:
- **llms.txt** — AI content roadmap file
- **Schema.org / JSON-LD** — Structured product data
- **robots.txt** — AI crawler access
- **Product data quality** — Description depth, alt text, FAQs
- **agent.json** — AI agent discovery file

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Deploying to Production (Fly.io)](#deploying-to-production)
4. [Submitting to the Shopify App Store](#submitting-to-the-shopify-app-store)
5. [App Store Listing Copy](#app-store-listing-copy)
6. [Monetization Setup](#monetization-setup)
7. [File Structure](#file-structure)

---

## Prerequisites

You need to install these tools first (all free):

### 1. Node.js (v18 or higher)
- Download from: https://nodejs.org
- Choose the "LTS" version
- Verify install: open Terminal and type `node --version`

### 2. Shopify CLI
```bash
npm install -g @shopify/cli @shopify/theme
```

### 3. A Shopify Partner Account (free)
- Sign up at: https://partners.shopify.com
- This is your developer account — different from a merchant account

### 4. A Shopify Development Store (free)
- In your Partner Dashboard → Stores → Add store → Development store
- This is where you'll test the app

---

## Local Development Setup

### Step 1: Install dependencies
```bash
cd shopify-ai-auditor
npm install
```

### Step 2: Create your app in the Partner Dashboard
1. Go to https://partners.shopify.com
2. Click **Apps** in the left sidebar
3. Click **Create app** → **Create app manually**
4. Name it "AI Readiness Auditor"
5. Copy the **Client ID** and **Client Secret**

### Step 3: Set up environment variables
```bash
cp .env.example .env
```
Then edit `.env` and fill in:
- `SHOPIFY_API_KEY` = your Client ID from Step 2
- `SHOPIFY_API_SECRET` = your Client Secret from Step 2

### Step 4: Set up the database
```bash
npx prisma migrate dev --name init
```

### Step 5: Link your app config
```bash
shopify app config link
```
Follow the prompts — select your Partner account and the app you created.

### Step 6: Start the development server
```bash
shopify app dev
```

This will:
- Start a local server
- Create a tunnel via ngrok (so Shopify can reach your local machine)
- Open your development store with the app installed

You should see the app appear inside your Shopify admin at **Apps → AI Readiness Auditor**.

---

## Deploying to Production

We recommend **Fly.io** — it's the easiest and cheapest option (~$5–10/month).

### Step 1: Install Fly CLI
```bash
# Mac/Linux:
curl -L https://fly.io/install.sh | sh

# Windows:
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Step 2: Create a Fly account
```bash
fly auth signup
```

### Step 3: Create the Fly app
```bash
fly launch
```
- When prompted: choose a name like `ai-readiness-auditor`
- Select a region close to your users (e.g., `lhr` for London, `iad` for US East)
- Say **No** to deploying immediately

### Step 4: Create the flyctl.toml (if not auto-created)
```toml
app = "ai-readiness-auditor"
primary_region = "lhr"

[build]

[env]
  PORT = "3000"
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 1
```

### Step 5: Add a PostgreSQL database on Fly
```bash
fly postgres create --name ai-auditor-db
fly postgres attach ai-auditor-db
```
This sets `DATABASE_URL` automatically.

### Step 6: Set environment secrets on Fly
```bash
fly secrets set SHOPIFY_API_KEY=your_key_here
fly secrets set SHOPIFY_API_SECRET=your_secret_here
fly secrets set SHOPIFY_APP_URL=https://ai-readiness-auditor.fly.dev
fly secrets set SCOPES=read_products,read_content,read_themes,read_script_tags,read_metafields,read_online_store_pages
```

### Step 7: Update Prisma for PostgreSQL (production)
Edit `prisma/schema.prisma` — change the datasource:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 8: Deploy
```bash
fly deploy
```

### Step 9: Update your app URLs in Partner Dashboard
1. Go to Partners Dashboard → Apps → AI Readiness Auditor → Configuration
2. Set **App URL** to: `https://ai-readiness-auditor.fly.dev`
3. Set **Allowed redirection URLs** to:
   - `https://ai-readiness-auditor.fly.dev/auth/callback`
   - `https://ai-readiness-auditor.fly.dev/auth/shopify/callback`
4. Save

---

## Submitting to the Shopify App Store

### Requirements checklist before submitting:
- [ ] App is deployed and publicly accessible
- [ ] App works correctly on a real development store
- [ ] Privacy policy URL is live (use Termly.io or similar — free)
- [ ] App listing has screenshots (minimum 3, recommended 6)
- [ ] Support email address is set up

### Step 1: Create your app listing
In Partner Dashboard → Apps → Your App → **Distribution** → **Shopify App Store**

Fill in:
- **App name**: AI Readiness Auditor
- **Tagline**: See how visible your store is to ChatGPT, Claude & Perplexity
- **Description**: (use the copy in the App Store Listing section below)
- **Category**: Marketing → SEO

### Step 2: Take screenshots
Take screenshots of:
1. The main dashboard with an audit score
2. The findings breakdown (expanded cards)
3. The generated llms.txt file
4. The audit history page
5. The generate files page

**Screenshot dimensions**: 1600 × 900px minimum

### Step 3: Set up billing (for paid plans)
In the app code, add Shopify Billing API calls.
See: https://shopify.dev/docs/apps/monetization/billing-api

### Step 4: Submit for review
1. In Partner Dashboard → Apps → Your App → **Submit for review**
2. Run the automated checks (they flag common issues)
3. Click **Submit**

Shopify reviews within 5–7 business days.

---

## App Store Listing Copy

### App name
AI Readiness Auditor: LLMs, Schema & SEO

### Tagline
See how visible your store is to ChatGPT, Claude, Perplexity & AI shopping agents

### Description
```
AI is changing how customers discover products. Instead of Googling, 
shoppers are asking ChatGPT "what's the best candle for relaxation?" — 
and getting direct product recommendations.

Is your store showing up in those answers?

AI Readiness Auditor checks your store across 5 dimensions and gives 
you an actionable score in under 60 seconds.

WHAT WE AUDIT:

✓ llms.txt — The most important file for AI visibility. We check if 
  yours exists, and generate a perfect one for your store.

✓ Schema.org / JSON-LD — The structured data that lets AI understand 
  your products, prices, and reviews. Missing this = invisible to AI.

✓ robots.txt crawler access — Are GPTBot, ClaudeBot, and PerplexityBot 
  allowed to visit your store? We check and tell you exactly how to fix it.

✓ Product data quality — Description length, image alt text, FAQ pages, 
  and AI-specific metafields. We score your content on what AI engines 
  actually need.

✓ agent.json — An emerging standard for AI shopping agents. Get ahead 
  of the curve before your competitors do.

WHAT YOU GET:
• An AI Readiness Score out of 100 with a letter grade
• Specific, actionable fixes for every issue found
• Auto-generated llms.txt tailored to your exact store
• Auto-generated agent.json ready to deploy
• Schema.org templates for your products
• robots.txt additions to allow AI crawlers
• Audit history to track your improvement over time

WHO IT'S FOR:
Any Shopify merchant who wants their products recommended by AI tools. 
Early adopters will have a significant advantage as AI-powered shopping 
continues to grow.

No technical knowledge required. Most fixes take less than 10 minutes.
```

### Key benefits (bullet points for listing)
- AI Readiness Score out of 100 — know exactly where you stand
- Auto-generates llms.txt, agent.json, and Schema.org templates
- Check if GPTBot, ClaudeBot & PerplexityBot can access your store
- Audit history to track score improvements over time
- No coding required — step-by-step fix instructions included

---

## Monetization Setup

### Recommended pricing tiers

| Plan     | Price    | Features                                          |
|----------|----------|---------------------------------------------------|
| Free     | $0/mo    | 1 audit per month, basic score, no file generation|
| Starter  | $9/mo    | Unlimited audits, file generation, history        |
| Pro      | $29/mo   | Everything + weekly auto-audits, email alerts      |

### Adding Shopify Billing to the app

In `app/routes/app._index.tsx`, add a billing check:

```typescript
import { authenticate } from "../shopify.server";
import shopify from "../shopify.server";

// In your loader:
const billing = await authenticate.billing(request, {
  "Starter Plan": {
    amount: 9,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
  },
  "Pro Plan": {
    amount: 29,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
  },
});
```

Full billing docs: https://shopify.dev/docs/apps/monetization/billing-api

---

## File Structure

```
shopify-ai-auditor/
├── app/
│   ├── routes/
│   │   ├── app.tsx              # App layout + nav
│   │   ├── app._index.tsx       # Dashboard
│   │   ├── app.audit.tsx        # Run audit page
│   │   ├── app.history.tsx      # Audit history
│   │   ├── app.generate.tsx     # File generator
│   │   ├── auth.$.tsx           # Auth handler
│   │   └── webhooks.tsx         # Webhook handler
│   ├── utils/
│   │   ├── audit.server.ts      # Core audit engine (5 checks)
│   │   └── queries.ts           # GraphQL queries
│   ├── shopify.server.ts        # Shopify app config
│   ├── root.tsx                 # Remix root
│   └── entry.server.tsx         # SSR entry
├── prisma/
│   └── schema.prisma            # Database schema
├── shopify.app.toml             # App configuration
├── vite.config.ts               # Build config
├── package.json
└── .env.example                 # Environment variables template
```

---

## Support & Troubleshooting

### Common issues:

**"Shop not found" error on install**
- Make sure your `SHOPIFY_APP_URL` in `.env` matches exactly what's in the Partner Dashboard

**Database migration errors**
- Run `npx prisma migrate reset` to reset the dev database
- Run `npx prisma generate` to regenerate the client

**App not loading in Shopify admin**
- Check that your ngrok tunnel is running (`shopify app dev`)
- Make sure the redirect URLs in Partner Dashboard include your current ngrok URL

**Audit returning all fails**
- This is normal for new stores — it means the checks are working correctly
- Follow the fix instructions in each finding card

### Getting help:
- Shopify Developer Docs: https://shopify.dev/docs/apps
- Shopify Partner Community: https://community.shopify.dev
- Remix Docs: https://remix.run/docs

---

## Next Steps After Launch

1. **Add email notifications** — Alert merchants when their score drops
2. **Scheduled re-audits** — Auto-run weekly via Shopify Flow
3. **Competitor comparison** — Let merchants benchmark against similar stores
4. **AI traffic analytics** — Track visits from GPTBot, ClaudeBot etc. via Shopify Analytics
5. **One-click fixes** — Auto-install the llms.txt file via the Storefront API
