import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  useActionData,
  useNavigation,
  useSubmit,
  useLoaderData,
} from "@remix-run/react";
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
  Collapsible,
  List,
  Tabs,
  TextField,
  Spinner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate, prisma } from "../shopify.server";
import {
  runAudit,
  type AuditReport,
  type AuditFinding,
} from "../utils/audit.server";
import { SHOP_DATA_QUERY, PAGES_QUERY } from "../utils/queries";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);

  try {
    // Fetch store data via GraphQL
    const shopResponse = await admin.graphql(SHOP_DATA_QUERY);
    const shopJson = await shopResponse.json();

    const pagesResponse = await admin.graphql(PAGES_QUERY);
    const pagesJson = await pagesResponse.json();

    const shopData = shopJson.data;
    const pagesData = pagesJson.data;

    // Shape data for audit engine
    const auditData = {
      shop: session.shop,
      myshopifyDomain: session.shop,
      name: shopData.shop.name,
      email: shopData.shop.email,
      domain:
        shopData.shop.primaryDomain?.host ||
        session.shop.replace(".myshopify.com", ".com"),
      products: (shopData.products?.edges || []).map((e: any) => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        descriptionHtml: e.node.descriptionHtml || "",
        images: (e.node.images?.edges || []).map((ie: any) => ({
          url: ie.node.url,
          altText: ie.node.altText,
        })),
        variants: (e.node.variants?.edges || []).map((ve: any) => ({
          price: ve.node.price,
        })),
        metafields: (e.node.metafields?.edges || []).map((me: any) => ({
          namespace: me.node.namespace,
          key: me.node.key,
          value: me.node.value,
        })),
      })),
      collections: (shopData.collections?.edges || []).map((e: any) => ({
        title: e.node.title,
        handle: e.node.handle,
        description: e.node.description || "",
      })),
      pages: (pagesData.pages?.edges || []).map((e: any) => ({
        title: e.node.title,
        handle: e.node.handle,
        bodySummary: e.node.bodySummary || "",
      })),
      themes: [],
      metafields: [],
    };

    // Run the audit
    const report = await runAudit(auditData);

    // Save to database
    await prisma.auditResult.create({
      data: {
        shop: session.shop,
        score: report.totalScore,
        llmsScore: report.findings.find((f) => f.id === "llms")?.score || 0,
        schemaScore: report.findings.find((f) => f.id === "schema")?.score || 0,
        robotsScore: report.findings.find((f) => f.id === "robots")?.score || 0,
        qualityScore: report.findings.find((f) => f.id === "quality")?.score || 0,
        agentScore: report.findings.find((f) => f.id === "agent")?.score || 0,
        llmsTxt: report.generatedFiles.llmsTxt,
        agentJson: report.generatedFiles.agentJson,
        schemaJson: report.generatedFiles.schemaExample,
        findings: JSON.stringify(report.findings),
      },
    });

    return json({ success: true, report });
  } catch (error: any) {
    console.error("Audit error:", error);
    return json({ success: false, error: error.message });
  }
}

export default function AuditPage() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [selectedTab, setSelectedTab] = useState(0);
  const [openFinding, setOpenFinding] = useState<string | null>(null);

  const isRunning = navigation.state === "submitting";
  const report = actionData?.success ? actionData.report as AuditReport : null;

  const handleRunAudit = useCallback(() => {
    submit({}, { method: "POST" });
  }, [submit]);

  const tabs = [
    { id: "findings", content: "Findings" },
    { id: "generate", content: "Generate files" },
    { id: "schema", content: "Schema template" },
    { id: "robots", content: "robots.txt fix" },
  ];

  const pct = report ? Math.round((report.totalScore / report.maxScore) * 100) : 0;
  const gradeColor = pct >= 70 ? "success" : pct >= 40 ? "warning" : "critical";
  const badgeTone = pct >= 70 ? "success" : pct >= 40 ? "warning" : "critical";

  return (
    <Page
      title="Run AI Readiness Audit"
      subtitle={`Auditing ${shop}`}
      primaryAction={
        !isRunning
          ? {
              content: report ? "Re-run audit" : "Start audit",
              onAction: handleRunAudit,
            }
          : undefined
      }
    >
      <Layout>
        {/* Running state */}
        {isRunning && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400" align="center">
                <Spinner size="large" />
                <Text variant="headingMd" as="h2" alignment="center">
                  Auditing your store...
                </Text>
                <Text variant="bodyMd" tone="subdued" alignment="center">
                  Checking llms.txt, Schema.org, robots.txt, product quality, and agent.json
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Error state */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner title="Audit failed" tone="critical">
              <p>{(actionData as any).error || "Something went wrong. Please try again."}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Results */}
        {report && !isRunning && (
          <>
            {/* Score header */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text variant="headingXl" as="h2">
                        AI Readiness Score
                      </Text>
                      <Text variant="bodyMd" tone="subdued">
                        Audited {new Date(report.auditedAt).toLocaleString()}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100" inlineSize="auto">
                      <Text variant="heading2xl" as="p" alignment="end">
                        <span
                          style={{
                            color:
                              pct >= 70
                                ? "var(--p-color-text-success)"
                                : pct >= 40
                                ? "var(--p-color-text-caution)"
                                : "var(--p-color-text-critical)",
                          }}
                        >
                          {pct}/100
                        </span>
                      </Text>
                      <InlineStack align="end">
                        <Badge tone={badgeTone}>{report.grade}</Badge>
                      </InlineStack>
                    </BlockStack>
                  </InlineStack>
                  <ProgressBar progress={pct} tone={gradeColor} size="large" />

                  {/* Mini scores */}
                  <InlineStack gap="300" wrap>
                    {report.findings.map((f) => {
                      const fpct = Math.round((f.score / f.maxScore) * 100);
                      return (
                        <Badge
                          key={f.id}
                          tone={fpct >= 70 ? "success" : fpct >= 40 ? "warning" : "critical"}
                        >
                          {f.title.split(" ")[0]}: {fpct}%
                        </Badge>
                      );
                    })}
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Tabs */}
            <Layout.Section>
              <Card padding="0">
                <Tabs
                  tabs={tabs}
                  selected={selectedTab}
                  onSelect={setSelectedTab}
                />
                <Box padding="400">
                  {/* Tab 0: Findings */}
                  {selectedTab === 0 && (
                    <BlockStack gap="300">
                      {report.findings
                        .sort((a, b) => {
                          const order = { fail: 0, warn: 1, pass: 2 };
                          return order[a.status] - order[b.status];
                        })
                        .map((finding) => (
                          <FindingCard
                            key={finding.id}
                            finding={finding}
                            isOpen={openFinding === finding.id}
                            onToggle={() =>
                              setOpenFinding(
                                openFinding === finding.id ? null : finding.id
                              )
                            }
                          />
                        ))}
                    </BlockStack>
                  )}

                  {/* Tab 1: Generate files */}
                  {selectedTab === 1 && (
                    <BlockStack gap="500">
                      <GeneratedFileBlock
                        title="llms.txt — copy and paste into Shopify Pages"
                        subtitle="Create a new page in Shopify Admin > Online Store > Pages with handle 'llms', then paste this content."
                        content={report.generatedFiles.llmsTxt}
                      />
                      <Divider />
                      <GeneratedFileBlock
                        title="agent.json — serve at /.well-known/agent.json"
                        subtitle="In Shopify Admin > Online Store > Navigation > URL Redirects, create a redirect from /.well-known/agent.json to a hosted file."
                        content={report.generatedFiles.agentJson}
                      />
                    </BlockStack>
                  )}

                  {/* Tab 2: Schema template */}
                  {selectedTab === 2 && (
                    <GeneratedFileBlock
                      title="Product Schema template (JSON-LD)"
                      subtitle="Add this inside <script type='application/ld+json'> tags in your product template. Replace static values with Liquid variables."
                      content={report.generatedFiles.schemaExample}
                    />
                  )}

                  {/* Tab 3: robots.txt fix */}
                  {selectedTab === 3 && (
                    <GeneratedFileBlock
                      title="robots.txt additions"
                      subtitle="In Shopify Admin > Online Store > Themes > Edit code, create or edit the robots.txt.liquid file with these rules."
                      content={report.generatedFiles.robotsTxtFix}
                    />
                  )}
                </Box>
              </Card>
            </Layout.Section>
          </>
        )}

        {/* Initial state - no audit run yet */}
        {!report && !isRunning && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400" align="center">
                <Text variant="headingLg" as="h2" alignment="center">
                  Ready to audit {shop}
                </Text>
                <Text variant="bodyMd" tone="subdued" alignment="center">
                  We'll check 5 dimensions of AI readiness in about 30–60 seconds.
                  No changes will be made to your store.
                </Text>
                <Button variant="primary" size="large" onClick={handleRunAudit}>
                  Start audit
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

// ─── FindingCard component ─────────────────────────────────────────
function FindingCard({
  finding,
  isOpen,
  onToggle,
}: {
  finding: AuditFinding;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const badgeTone =
    finding.status === "pass"
      ? "success"
      : finding.status === "warn"
      ? "warning"
      : "critical";
  const badgeLabel =
    finding.status === "pass"
      ? "Pass"
      : finding.status === "warn"
      ? "Needs attention"
      : "Missing";
  const pct = Math.round((finding.score / finding.maxScore) * 100);

  return (
    <Card>
      <BlockStack gap="200">
        <div
          onClick={onToggle}
          style={{ cursor: "pointer" }}
        >
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Text variant="bodyMd" fontWeight="semibold" as="span">
                {finding.title}
              </Text>
              <Badge tone={badgeTone}>{badgeLabel}</Badge>
            </InlineStack>
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodySm" tone="subdued">
                {finding.score}/{finding.maxScore} pts
              </Text>
              <Text variant="bodyMd" as="span">
                {isOpen ? "▲" : "▼"}
              </Text>
            </InlineStack>
          </InlineStack>
          <Box paddingBlockStart="200">
            <ProgressBar progress={pct} tone={badgeTone === "success" ? "success" : badgeTone === "warning" ? "warning" : "critical"} size="small" />
          </Box>
        </div>

        <Collapsible open={isOpen} id={`finding-${finding.id}`}>
          <Box paddingBlockStart="300">
            <BlockStack gap="300">
              <Text variant="bodyMd" tone="subdued">
                {finding.description}
              </Text>
              {finding.fixes.length > 0 && (
                <>
                  <Text variant="bodyMd" fontWeight="semibold" as="p">
                    How to fix:
                  </Text>
                  <List type="bullet">
                    {finding.fixes.map((fix, i) => (
                      <List.Item key={i}>{fix}</List.Item>
                    ))}
                  </List>
                </>
              )}
            </BlockStack>
          </Box>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}

// ─── GeneratedFileBlock component ──────────────────────────────────
function GeneratedFileBlock({
  title,
  subtitle,
  content,
}: {
  title: string;
  subtitle: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <BlockStack gap="300">
      <BlockStack gap="100">
        <Text variant="headingMd" as="h3">{title}</Text>
        <Text variant="bodyMd" tone="subdued">{subtitle}</Text>
      </BlockStack>
      <div
        style={{
          background: "var(--p-color-bg-surface-secondary)",
          borderRadius: "var(--p-border-radius-200)",
          padding: "1rem",
          fontFamily: "monospace",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
          maxHeight: "280px",
          overflowY: "auto",
          lineHeight: 1.6,
          color: "var(--p-color-text)",
        }}
      >
        {content}
      </div>
      <InlineStack>
        <Button onClick={handleCopy} variant="secondary">
          {copied ? "Copied!" : "Copy to clipboard"}
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
