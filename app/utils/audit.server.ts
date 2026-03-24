/**
 * AI Readiness Audit Engine
 * Audits a Shopify store across 5 dimensions of AI/LLM readiness
 */

export interface AuditFinding {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  score: number;
  maxScore: number;
  description: string;
  fixes: string[];
  priority: "critical" | "high" | "medium" | "low";
}

export interface AuditReport {
  shop: string;
  totalScore: number;
  maxScore: number;
  grade: string;
  findings: AuditFinding[];
  generatedFiles: {
    llmsTxt: string;
    agentJson: string;
    schemaExample: string;
    robotsTxtFix: string;
  };
  auditedAt: string;
}

export interface ShopData {
  shop: string;
  name: string;
  email: string;
  domain: string;
  myshopifyDomain: string;
  products: Product[];
  pages: Page[];
  collections: Collection[];
  themes: Theme[];
  metafields: Metafield[];
}

interface Product {
  id: string;
  title: string;
  descriptionHtml: string;
  handle: string;
  images: { url: string; altText: string | null }[];
  variants: { price: string }[];
  metafields: { namespace: string; key: string; value: string }[];
}

interface Page {
  title: string;
  handle: string;
  bodySummary: string;
}

interface Collection {
  title: string;
  handle: string;
  description: string;
}

interface Theme {
  name: string;
  role: string;
}

interface Metafield {
  namespace: string;
  key: string;
  value: string;
}

// ─── Scoring weights ───────────────────────────────────────────────
const WEIGHTS = {
  llms: 25,
  schema: 25,
  robots: 15,
  quality: 20,
  agent: 15,
};

// ─── Grade thresholds ──────────────────────────────────────────────
function calcGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 55) return "C";
  if (pct >= 40) return "D";
  return "F";
}

// ─── AUDIT: llms.txt ───────────────────────────────────────────────
async function auditLlmsTxt(shopDomain: string): Promise<AuditFinding> {
  let score = 0;
  let status: "pass" | "warn" | "fail" = "fail";
  let description = "";
  const fixes: string[] = [];

  try {
    const res = await fetch(`https://${shopDomain}/llms.txt`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const text = await res.text();
      score += 10; // file exists

      if (text.includes("##") || text.includes("- [")) score += 5; // has structure
      if (text.toLowerCase().includes("product")) score += 5; // mentions products
      if (text.toLowerCase().includes("collection")) score += 3; // mentions collections
      if (text.toLowerCase().includes("faq") || text.toLowerCase().includes("policy")) score += 2; // policies

      if (score >= 22) {
        status = "pass";
        description = "Your llms.txt file is present and well-structured. AI crawlers can efficiently discover your store content.";
      } else {
        status = "warn";
        description = "Your llms.txt file exists but is missing important sections like product collections, FAQ, and policy links.";
        fixes.push("Add a ## Collections section with links to all your product categories");
        fixes.push("Include links to your FAQ and shipping/returns policy pages");
        fixes.push("Add a blockquote summary describing your store's unique value");
      }
    } else {
      status = "fail";
      score = 0;
      description = "No llms.txt file found. This is the single most important step for AI visibility — it tells ChatGPT, Claude, and Perplexity what your store sells.";
      fixes.push("Create an llms.txt file at yourstore.com/llms.txt (use the generator below)");
      fixes.push("In Shopify admin: go to Online Store → Pages → create a page with handle 'llms'");
      fixes.push("Add your store name, description, product collections, and key page links");
      fixes.push("Use the Markdown format shown in the generated file tab");
    }
  } catch {
    status = "fail";
    score = 0;
    description = "Could not check for llms.txt — your store may be blocking automated checks, or the file doesn't exist.";
    fixes.push("Create an llms.txt file at yourstore.com/llms.txt (use the generator below)");
  }

  return {
    id: "llms",
    title: "llms.txt file",
    status,
    score,
    maxScore: WEIGHTS.llms,
    description,
    fixes,
    priority: "critical",
  };
}

// ─── AUDIT: Schema.org ─────────────────────────────────────────────
async function auditSchema(shopDomain: string, products: Product[]): Promise<AuditFinding> {
  let score = 0;
  let status: "pass" | "warn" | "fail" = "fail";
  const fixes: string[] = [];

  try {
    // Check first product page for schema
    const handle = products[0]?.handle || "products";
    const res = await fetch(`https://${shopDomain}/products/${handle}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ShopifyAuditBot/1.0" },
    });

    if (res.ok) {
      const html = await res.text();
      const hasProductSchema = html.includes('"@type":"Product"') || html.includes('"@type": "Product"');
      const hasOfferSchema = html.includes('"@type":"Offer"') || html.includes('"Offer"');
      const hasRatingSchema = html.includes("AggregateRating") || html.includes("aggregateRating");
      const hasReviewSchema = html.includes('"@type":"Review"') || html.includes('"Review"');
      const hasBreadcrumb = html.includes("BreadcrumbList");
      const hasJsonLd = html.includes('application/ld+json');

      if (hasJsonLd) score += 5;
      if (hasProductSchema) score += 7;
      if (hasOfferSchema) score += 5;
      if (hasRatingSchema) score += 4;
      if (hasReviewSchema) score += 2;
      if (hasBreadcrumb) score += 2;

      if (score >= 20) {
        status = "pass";
      } else if (score >= 10) {
        status = "warn";
      } else {
        status = "fail";
      }

      const missing = [];
      if (!hasRatingSchema) missing.push("AggregateRating");
      if (!hasReviewSchema) missing.push("Review");
      if (!hasBreadcrumb) missing.push("BreadcrumbList");

      if (missing.length > 0) {
        fixes.push(`Add missing schema types: ${missing.join(", ")}`);
      }
      if (!hasRatingSchema) {
        fixes.push("Ensure your review app (Judge.me, Yotpo, Loox) outputs JSON-LD not just JavaScript widgets");
      }
      fixes.push("Add FAQPage schema to product pages with common customer questions");
      fixes.push("Use Google's Rich Results Test to verify your schema is valid");
    }
  } catch {
    score = 0;
    status = "fail";
    fixes.push("Install a Schema.org app from the Shopify App Store (e.g. Schema Plus, JSON-LD for SEO)");
    fixes.push("At minimum, add Product + Offer schema to every product page");
  }

  const description = status === "pass"
    ? "Good schema coverage detected. AI models can understand your products, pricing, and reviews."
    : status === "warn"
    ? "Basic product schema found but AggregateRating and Review schema are missing. AI models use reviews to build trust when recommending products."
    : "No structured data (Schema.org JSON-LD) detected. AI models cannot reliably extract your product data from unstructured HTML.";

  return {
    id: "schema",
    title: "Schema.org / JSON-LD structured data",
    status,
    score: Math.min(score, WEIGHTS.schema),
    maxScore: WEIGHTS.schema,
    description,
    fixes,
    priority: "critical",
  };
}

// ─── AUDIT: robots.txt ─────────────────────────────────────────────
async function auditRobots(shopDomain: string): Promise<AuditFinding> {
  let score = 0;
  let status: "pass" | "warn" | "fail" = "fail";
  let description = "";
  const fixes: string[] = [];

  const aiBots = [
    { name: "GPTBot", operator: "ChatGPT" },
    { name: "ClaudeBot", operator: "Claude / Anthropic" },
    { name: "PerplexityBot", operator: "Perplexity" },
    { name: "Google-Extended", operator: "Google AI Overviews" },
    { name: "Googlebot", operator: "Google" },
    { name: "anthropic-ai", operator: "Anthropic" },
    { name: "cohere-ai", operator: "Cohere" },
  ];

  try {
    const res = await fetch(`https://${shopDomain}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const text = await res.text();
      const allowed: string[] = [];
      const blocked: string[] = [];

      for (const bot of aiBots) {
        const botLower = bot.name.toLowerCase();
        const textLower = text.toLowerCase();
        // Check if explicitly blocked
        const isBlocked =
          textLower.includes(`user-agent: ${botLower}`) &&
          textLower.includes("disallow: /");
        const isAllowed =
          !isBlocked &&
          (textLower.includes(`user-agent: ${botLower}`) ||
            !textLower.includes(botLower));

        if (isAllowed) {
          allowed.push(bot.name);
          score += 2;
        } else {
          blocked.push(bot.name);
        }
      }

      score = Math.min(score, WEIGHTS.robots);

      if (blocked.length === 0) {
        status = "pass";
        description = "All major AI crawlers are allowed to access your store. Your content can be indexed and recommended by AI systems.";
      } else if (blocked.length <= 2) {
        status = "warn";
        description = `${blocked.length} AI crawler(s) are blocked: ${blocked.join(", ")}. These platforms won't be able to recommend your products.`;
        blocked.forEach((b) => {
          fixes.push(`Unblock ${b} by removing its Disallow rule in robots.txt`);
        });
      } else {
        status = "fail";
        description = `Multiple AI crawlers are blocked (${blocked.join(", ")}). Your store is essentially invisible to AI-powered search.`;
        fixes.push("Review your robots.txt and remove Disallow rules for AI crawlers");
        fixes.push("Add explicit Allow rules: User-agent: GPTBot / Allow: /");
      }

      fixes.push("Block non-value pages: /cart, /checkout, /account, /orders");
      fixes.push("Keep /products, /collections, /pages, /blogs fully accessible to all bots");
    }
  } catch {
    score = 5; // assume default Shopify robots.txt which is fairly permissive
    status = "warn";
    description = "Could not fetch robots.txt to verify AI crawler access.";
    fixes.push("Ensure your robots.txt is accessible at yourstore.com/robots.txt");
    fixes.push("Add explicit Allow rules for GPTBot, ClaudeBot, PerplexityBot");
  }

  return {
    id: "robots",
    title: "robots.txt — AI crawler access",
    status,
    score,
    maxScore: WEIGHTS.robots,
    description,
    fixes,
    priority: "high",
  };
}

// ─── AUDIT: Product quality ────────────────────────────────────────
function auditProductQuality(products: Product[], pages: Page[]): AuditFinding {
  let score = 0;
  const fixes: string[] = [];

  if (products.length === 0) {
    return {
      id: "quality",
      title: "Product data quality",
      status: "fail",
      score: 0,
      maxScore: WEIGHTS.quality,
      description: "No products found. Add products to your store to enable AI discovery.",
      fixes: ["Add products with detailed descriptions to your Shopify store"],
      priority: "high",
    };
  }

  // Average description length
  const avgDescLen =
    products.reduce((sum, p) => {
      const text = p.descriptionHtml.replace(/<[^>]+>/g, "");
      return sum + text.length;
    }, 0) / products.length;

  if (avgDescLen > 400) score += 6;
  else if (avgDescLen > 200) score += 4;
  else if (avgDescLen > 100) score += 2;

  // Images with alt text
  const productsWithAlt = products.filter(
    (p) => p.images.length > 0 && p.images.some((img) => img.altText && img.altText.length > 3)
  ).length;
  const altTextRatio = productsWithAlt / products.length;
  if (altTextRatio > 0.8) score += 4;
  else if (altTextRatio > 0.5) score += 2;

  // FAQ or policy pages
  const hasFAQ = pages.some(
    (p) =>
      p.title.toLowerCase().includes("faq") ||
      p.handle.includes("faq") ||
      p.bodySummary.toLowerCase().includes("frequently asked")
  );
  if (hasFAQ) score += 4;

  // Multiple product images
  const avgImages = products.reduce((s, p) => s + p.images.length, 0) / products.length;
  if (avgImages >= 3) score += 3;
  else if (avgImages >= 1) score += 1;

  // AI metafield (custom.ai_context)
  const hasAiMetafield = products.some((p) =>
    p.metafields?.some((m) => m.namespace === "custom" && m.key === "ai_context")
  );
  if (hasAiMetafield) score += 3;

  score = Math.min(score, WEIGHTS.quality);

  // Build fixes
  if (avgDescLen < 200) {
    fixes.push(
      `Expand product descriptions (avg ${Math.round(avgDescLen)} chars). Aim for 300+ characters with factual details`
    );
    fixes.push(
      'Use conversational language: "ideal for stress relief at bedtime" not "relaxing candle"'
    );
  }
  if (altTextRatio < 0.8) {
    fixes.push(
      `Add descriptive alt text to product images (${Math.round((1 - altTextRatio) * 100)}% of products are missing it)`
    );
  }
  if (!hasFAQ) {
    fixes.push("Create a FAQ page or add FAQ sections to product pages");
  }
  if (!hasAiMetafield) {
    fixes.push(
      'Add a custom.ai_context metafield to products with problem-solution descriptions for AI models'
    );
  }
  fixes.push(
    "Ensure pricing and inventory data is always current — AI models penalize stale data"
  );

  const status: "pass" | "warn" | "fail" =
    score >= 16 ? "pass" : score >= 8 ? "warn" : "fail";

  return {
    id: "quality",
    title: "Product data quality",
    status,
    score,
    maxScore: WEIGHTS.quality,
    description:
      status === "pass"
        ? "Strong product data quality. Your descriptions, images, and page structure are well-optimised for AI understanding."
        : status === "warn"
        ? `Product descriptions average ${Math.round(avgDescLen)} characters — aim for 300+. ${!hasFAQ ? "No FAQ page found. " : ""}AI models need factual, detailed content to confidently recommend products.`
        : "Product data quality needs significant improvement. Short descriptions, missing alt text, and no FAQ make it hard for AI to understand and recommend your products.",
    fixes,
    priority: "high",
  };
}

// ─── AUDIT: agent.json ─────────────────────────────────────────────
async function auditAgentJson(shopDomain: string): Promise<AuditFinding> {
  let score = 0;
  let status: "pass" | "warn" | "fail" = "fail";
  let description = "";
  const fixes: string[] = [];

  try {
    const res = await fetch(`https://${shopDomain}/.well-known/agent.json`, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json();
      score += 5;
      if (json.name) score += 2;
      if (json.description) score += 2;
      if (json.capabilities) score += 3;
      if (json.data_feeds) score += 3;

      score = Math.min(score, WEIGHTS.agent);
      status = score >= 12 ? "pass" : "warn";
      description =
        score >= 12
          ? "agent.json is present and well-configured. AI shopping agents can discover your store capabilities."
          : "agent.json exists but is missing key fields like capabilities and data_feeds.";

      if (!json.capabilities) fixes.push("Add a capabilities array listing supported actions (product_search, order_status)");
      if (!json.data_feeds) fixes.push("Add data_feeds with links to your product feed and sitemap");
    } else {
      status = "fail";
      score = 0;
      description =
        "No agent.json found at /.well-known/agent.json. This emerging standard allows AI shopping agents to discover your store's capabilities. Early adoption gives a significant competitive advantage.";
      fixes.push("Create /.well-known/agent.json (use the generator below)");
      fixes.push("In Shopify: use a redirect rule to serve the file from Online Store → Navigation → URL Redirects");
      fixes.push("Declare your store name, description, product feed URL, and supported AI interaction modes");
    }
  } catch {
    status = "fail";
    score = 0;
    description = "Could not check for agent.json. This file is not yet present.";
    fixes.push("Create /.well-known/agent.json using the generator in the 'Generate files' tab");
  }

  return {
    id: "agent",
    title: "agent.json (AI agent discovery)",
    status,
    score,
    maxScore: WEIGHTS.agent,
    description,
    fixes,
    priority: "medium",
  };
}

// ─── File generators ───────────────────────────────────────────────
export function generateLlmsTxt(data: ShopData): string {
  const { name, domain, products, collections, pages } = data;

  const productLinks = products
    .slice(0, 20)
    .map((p) => `- [${p.title}](https://${domain}/products/${p.handle})`)
    .join("\n");

  const collectionLinks = collections
    .map((c) => `- [${c.title}](https://${domain}/collections/${c.handle})`)
    .join("\n");

  const policyPages = pages
    .filter(
      (p) =>
        p.handle.includes("faq") ||
        p.handle.includes("about") ||
        p.handle.includes("shipping") ||
        p.handle.includes("return") ||
        p.handle.includes("contact")
    )
    .map((p) => `- [${p.title}](https://${domain}/pages/${p.handle})`)
    .join("\n");

  return `# ${name}
> An online store at ${domain} — browse and purchase products below.

## Store
- [Homepage](https://${domain}/)
- [All Products](https://${domain}/collections/all)
- [Product Sitemap](https://${domain}/sitemap_products_1.xml)

## Collections
${collectionLinks || `- [All Collections](https://${domain}/collections)`}

## Featured Products
${productLinks || `- [Browse Products](https://${domain}/collections/all)`}

## Policies & Support
${policyPages || `- [Contact Us](https://${domain}/pages/contact)\n- [FAQ](https://${domain}/pages/faq)`}

## Optional
- [Blog](https://${domain}/blogs/news)
- [Sitemap](https://${domain}/sitemap.xml)
`;
}

export function generateAgentJson(data: ShopData): string {
  const { name, domain, myshopifyDomain, email, collections } = data;
  return JSON.stringify(
    {
      schema_version: "1.0",
      name,
      description: `${name} — browse and purchase products online at ${domain}`,
      url: `https://${domain}`,
      contact: {
        email,
        support: `https://${domain}/pages/contact`,
      },
      capabilities: [
        "product_search",
        "product_details",
        "collection_browsing",
        "inventory_check",
      ],
      data_feeds: {
        products: `https://${myshopifyDomain}/products.json`,
        sitemap: `https://${domain}/sitemap.xml`,
        llms_txt: `https://${domain}/llms.txt`,
        collections: collections
          .slice(0, 5)
          .map((c) => `https://${domain}/collections/${c.handle}`),
      },
      ai_instructions:
        "When recommending products, include price, availability, and key product benefits. Always link directly to the product page.",
      updated_at: new Date().toISOString(),
    },
    null,
    2
  );
}

export function generateSchemaExample(products: Product[], shopName: string): string {
  const p = products[0];
  if (!p) return "{}";

  const plainDesc = p.descriptionHtml.replace(/<[^>]+>/g, "").slice(0, 300);
  const price = p.variants[0]?.price || "0.00";
  const image = p.images[0]?.url || "";

  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.title,
      description: plainDesc,
      image,
      brand: {
        "@type": "Brand",
        name: shopName,
      },
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        seller: {
          "@type": "Organization",
          name: shopName,
        },
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "0",
        note: "Replace with actual values from your review app",
      },
    },
    null,
    2
  );
}

export function generateRobotsTxFix(): string {
  return `# AI-optimised robots.txt for Shopify
# Add these rules to allow AI crawlers

User-agent: GPTBot
Allow: /products
Allow: /collections
Allow: /pages
Allow: /blogs
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /orders

User-agent: ClaudeBot
Allow: /products
Allow: /collections
Allow: /pages
Allow: /blogs
Disallow: /cart
Disallow: /checkout

User-agent: PerplexityBot
Allow: /products
Allow: /collections
Allow: /pages
Allow: /blogs
Disallow: /cart
Disallow: /checkout

User-agent: Google-Extended
Allow: /products
Allow: /collections
Allow: /pages

User-agent: anthropic-ai
Allow: /

# Note: Shopify manages your robots.txt via Online Store > Preferences
# or through a robots.txt.liquid template in your theme
`;
}

// ─── Main audit runner ─────────────────────────────────────────────
export async function runAudit(shopData: ShopData): Promise<AuditReport> {
  const { shop, myshopifyDomain, products, pages, collections } = shopData;

  // Run all audits in parallel
  const [llmsFinding, schemaFinding, robotsFinding, agentFinding] =
    await Promise.all([
      auditLlmsTxt(myshopifyDomain),
      auditSchema(myshopifyDomain, products),
      auditRobots(myshopifyDomain),
      auditAgentJson(myshopifyDomain),
    ]);

  const qualityFinding = auditProductQuality(products, pages);

  const findings = [llmsFinding, schemaFinding, robotsFinding, qualityFinding, agentFinding];
  const totalScore = findings.reduce((s, f) => s + f.score, 0);
  const maxScore = findings.reduce((s, f) => s + f.maxScore, 0);
  const pct = Math.round((totalScore / maxScore) * 100);

  return {
    shop,
    totalScore,
    maxScore,
    grade: calcGrade(pct),
    findings,
    generatedFiles: {
      llmsTxt: generateLlmsTxt(shopData),
      agentJson: generateAgentJson(shopData),
      schemaExample: generateSchemaExample(products, shopData.name),
      robotsTxtFix: generateRobotsTxFix(),
    },
    auditedAt: new Date().toISOString(),
  };
}
