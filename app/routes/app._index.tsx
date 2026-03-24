import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Banner,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Box,
  ProgressBar,
} from "@shopify/polaris";
import { authenticate, prisma } from "../shopify.server";
import type { AuditReport } from "../utils/audit.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Get the most recent audit for this shop
  const lastAudit = await prisma.auditResult.findFirst({
    where: { shop },
    orderBy: { createdAt: "desc" },
  });

  return json({ shop, lastAudit });
}

export default function Index() {
  const { shop, lastAudit } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const hasAudit = !!lastAudit;
  const score = lastAudit?.score || 0;
  const gradeColor =
    score >= 70 ? "success" : score >= 40 ? "warning" : "critical";

  return (
    <Page>
      <Layout>
        {/* Hero banner */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingXl" as="h1">
                    AI Readiness Auditor
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    See how visible your store is to ChatGPT, Claude, Perplexity & AI shopping agents
                  </Text>
                </BlockStack>
                {hasAudit && (
                  <div style={{ textAlign: "center" }}>
                    <Text variant="heading2xl" as="p" tone={gradeColor}>
                      {score}/100
                    </Text>
                    <Text variant="bodyMd" tone="subdued">AI Readiness Score</Text>
                  </div>
                )}
              </InlineStack>

              {hasAudit && (
                <ProgressBar
                  progress={score}
                  tone={gradeColor}
                  size="large"
                />
              )}

              <InlineStack gap="200">
                <Button
                  variant="primary"
                  size="large"
                  onClick={() => navigate("/app/audit")}
                >
                  {hasAudit ? "Re-run Audit" : "Run Your First Audit"}
                </Button>
                {hasAudit && (
                  <Button onClick={() => navigate("/app/generate")}>
                    Generate AI Files
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Score breakdown if audit exists */}
        {hasAudit && lastAudit && (
          <Layout.Section>
            <Layout>
              <Layout.Section variant="oneThird">
                <ScoreCard
                  title="llms.txt"
                  score={lastAudit.llmsScore}
                  max={25}
                  description="AI content roadmap"
                />
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <ScoreCard
                  title="Schema.org"
                  score={lastAudit.schemaScore}
                  max={25}
                  description="Structured product data"
                />
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <ScoreCard
                  title="robots.txt"
                  score={lastAudit.robotsScore}
                  max={15}
                  description="AI crawler access"
                />
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <ScoreCard
                  title="Product quality"
                  score={lastAudit.qualityScore}
                  max={20}
                  description="Data richness & detail"
                />
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <ScoreCard
                  title="agent.json"
                  score={lastAudit.agentScore}
                  max={15}
                  description="AI agent discovery"
                />
              </Layout.Section>
            </Layout>
          </Layout.Section>
        )}

        {/* No audit yet */}
        {!hasAudit && (
          <Layout.Section>
            <Banner
              title="You haven't run an audit yet"
              action={{ content: "Run audit now", onAction: () => navigate("/app/audit") }}
              tone="info"
            >
              <p>
                Discover how visible your store is to AI systems in under 60 seconds.
                We check llms.txt, Schema.org, robots.txt, product quality, and agent.json.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {/* What we check */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">What we audit</Text>
              <Divider />
              {[
                {
                  icon: "📄",
                  title: "llms.txt",
                  desc: "The most important signal for AI engines — a structured map of your store content in Markdown format.",
                  tag: "Critical",
                },
                {
                  icon: "{}",
                  title: "Schema.org / JSON-LD",
                  desc: "Structured product data that lets AI understand your products, prices, reviews, and availability.",
                  tag: "Critical",
                },
                {
                  icon: "🤖",
                  title: "robots.txt AI crawlers",
                  desc: "Checks if GPTBot, ClaudeBot, PerplexityBot and Google-Extended can access your store.",
                  tag: "High",
                },
                {
                  icon: "⭐",
                  title: "Product data quality",
                  desc: "Description length, alt text, FAQ pages, metafields — the signals AI uses to confidently recommend you.",
                  tag: "High",
                },
                {
                  icon: "🔌",
                  title: "agent.json",
                  desc: "An emerging standard that lets AI shopping agents discover your store capabilities and product feeds.",
                  tag: "Medium",
                },
              ].map((item) => (
                <Box key={item.title}>
                  <InlineStack gap="300" blockAlign="start">
                    <Text variant="bodyLg" as="span">{item.icon}</Text>
                    <BlockStack gap="100" inlineSize="fill">
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                          {item.title}
                        </Text>
                        <Badge
                          tone={
                            item.tag === "Critical"
                              ? "critical"
                              : item.tag === "High"
                              ? "warning"
                              : "info"
                          }
                        >
                          {item.tag}
                        </Badge>
                      </InlineStack>
                      <Text variant="bodyMd" tone="subdued">{item.desc}</Text>
                    </BlockStack>
                  </InlineStack>
                  <Box paddingBlockStart="300">
                    <Divider />
                  </Box>
                </Box>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function ScoreCard({
  title,
  score,
  max,
  description,
}: {
  title: string;
  score: number;
  max: number;
  description: string;
}) {
  const pct = Math.round((score / max) * 100);
  const tone = pct >= 70 ? "success" : pct >= 40 ? "caution" : "critical";
  const badgeTone = pct >= 70 ? "success" : pct >= 40 ? "warning" : "critical";

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between">
          <Text variant="bodyMd" fontWeight="semibold" as="span">{title}</Text>
          <Badge tone={badgeTone}>{pct}%</Badge>
        </InlineStack>
        <ProgressBar progress={pct} tone={tone} size="small" />
        <Text variant="bodySm" tone="subdued">{description}</Text>
      </BlockStack>
    </Card>
  );
}
