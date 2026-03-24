import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  Tabs,
  Box,
  Banner,
  Divider,
  List,
  InlineStack,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate, prisma } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const lastAudit = await prisma.auditResult.findFirst({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    select: {
      llmsTxt: true,
      agentJson: true,
      schemaJson: true,
    },
  });

  return json({ lastAudit, shop: session.shop });
}

export default function GeneratePage() {
  const { lastAudit, shop } = useLoaderData<typeof loader>();
  const [selected, setSelected] = useState(0);

  const tabs = [
    { id: "llms", content: "llms.txt" },
    { id: "agent", content: "agent.json" },
    { id: "schema", content: "Schema.org" },
    { id: "robots", content: "robots.txt" },
  ];

  if (!lastAudit) {
    return (
      <Page title="Generate AI Files">
        <Layout>
          <Layout.Section>
            <Banner
              title="Run an audit first"
              action={{ content: "Run audit", url: "/app/audit" }}
              tone="info"
            >
              <p>Run a store audit to generate personalised AI readiness files for {shop}.</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const files: Record<string, { content: string; instructions: string[]; fileName: string }> = {
    llms: {
      fileName: "llms.txt",
      content: lastAudit.llmsTxt || "",
      instructions: [
        "Go to Shopify Admin → Online Store → Pages",
        "Click 'Add page'",
        "Set the title to 'LLMs' and the handle (URL slug) to 'llms'",
        "Paste the content below into the page body",
        "Save and publish the page",
        "Your llms.txt will be live at yourstore.com/llms.txt via a redirect",
        "Alternatively: In Online Store → Navigation → URL Redirects, redirect /llms.txt to /pages/llms",
      ],
    },
    agent: {
      fileName: "agent.json",
      content: lastAudit.agentJson || "",
      instructions: [
        "Host this file at yourstore.com/.well-known/agent.json",
        "Option 1: Upload to a hosting service (Cloudflare Workers, Vercel) and create a redirect",
        "Option 2: In Online Store → Navigation → URL Redirects, create redirect from /.well-known/agent.json to your hosted file URL",
        "Verify it's accessible by visiting yourstore.com/.well-known/agent.json in a browser",
      ],
    },
    schema: {
      fileName: "product-schema.json",
      content: lastAudit.schemaJson || "",
      instructions: [
        "Go to Online Store → Themes → Edit code",
        "Open Sections → product-template.liquid (or main-product.liquid)",
        "Add a <script type='application/ld+json'> block in the <head> section",
        "Replace static values with Liquid variables: {{ product.title }}, {{ product.price | money_without_currency }}, etc.",
        "Use Google's Rich Results Test (search.google.com/test/rich-results) to validate",
        "Consider installing 'Schema Plus for SEO' from the App Store for automatic schema generation",
      ],
    },
    robots: {
      fileName: "robots-additions.txt",
      content: `User-agent: GPTBot
Allow: /products
Allow: /collections
Allow: /pages
Allow: /blogs
Disallow: /cart
Disallow: /checkout
Disallow: /account

User-agent: ClaudeBot
Allow: /products
Allow: /collections
Allow: /pages
Disallow: /cart
Disallow: /checkout

User-agent: PerplexityBot
Allow: /products
Allow: /collections
Allow: /pages
Disallow: /cart
Disallow: /checkout

User-agent: Google-Extended
Allow: /products
Allow: /collections

User-agent: anthropic-ai
Allow: /`,
      instructions: [
        "Go to Online Store → Themes → Edit code",
        "Look for robots.txt.liquid in the Config folder — if it doesn't exist, create it",
        "Add the rules below to the file",
        "Shopify Plus merchants can edit robots.txt directly",
        "Non-Plus merchants: go to Online Store → Preferences and check the robots.txt section",
        "Note: Shopify automatically generates a basic robots.txt; adding this file overrides it",
      ],
    },
  };

  const currentTabId = tabs[selected].id;
  const currentFile = files[currentTabId];

  function handleCopy() {
    navigator.clipboard.writeText(currentFile.content);
  }

  return (
    <Page
      title="Generate AI Files"
      subtitle="Copy these files to make your store visible to AI engines"
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Tabs tabs={tabs} selected={selected} onSelect={setSelected} />
            <Box padding="400">
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">
                    {currentFile.fileName}
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Follow the steps below to add this file to your store.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    Installation steps:
                  </Text>
                  <List type="number">
                    {currentFile.instructions.map((step, i) => (
                      <List.Item key={i}>{step}</List.Item>
                    ))}
                  </List>
                </BlockStack>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      File content:
                    </Text>
                    <Button onClick={handleCopy} variant="secondary" size="slim">
                      Copy to clipboard
                    </Button>
                  </InlineStack>
                  <div
                    style={{
                      background: "var(--p-color-bg-surface-secondary)",
                      borderRadius: "var(--p-border-radius-200)",
                      padding: "1rem",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      whiteSpace: "pre-wrap",
                      maxHeight: "320px",
                      overflowY: "auto",
                      lineHeight: 1.7,
                      color: "var(--p-color-text)",
                      border: "1px solid var(--p-color-border)",
                    }}
                  >
                    {currentFile.content}
                  </div>
                </BlockStack>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Help card */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Need help?</Text>
              <Text variant="bodyMd" tone="subdued">
                These files don't require any coding. They're plain text files
                that tell AI engines about your store.
              </Text>
              <Divider />
              <Text variant="bodyMd" fontWeight="semibold" as="p">Quick priority guide:</Text>
              <BlockStack gap="100">
                {[
                  { label: "llms.txt", priority: "Do this first", tone: "critical" as const },
                  { label: "Schema.org", priority: "Most impact on AI recommendations", tone: "critical" as const },
                  { label: "robots.txt", priority: "Allow AI crawlers in", tone: "warning" as const },
                  { label: "agent.json", priority: "Future-proofing", tone: "info" as const },
                ].map((item) => (
                  <InlineStack key={item.label} align="space-between">
                    <Text variant="bodySm" fontWeight="semibold" as="span">{item.label}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">{item.priority}</Text>
                  </InlineStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
