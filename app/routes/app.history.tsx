import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  DataTable,
  Badge,
  EmptyState,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import { authenticate, prisma } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const audits = await prisma.auditResult.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      score: true,
      llmsScore: true,
      schemaScore: true,
      robotsScore: true,
      qualityScore: true,
      agentScore: true,
    },
  });

  return json({ audits });
}

export default function HistoryPage() {
  const { audits } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  function gradeBadge(score: number) {
    if (score >= 70) return <Badge tone="success">{score}/100</Badge>;
    if (score >= 40) return <Badge tone="warning">{score}/100</Badge>;
    return <Badge tone="critical">{score}/100</Badge>;
  }

  function pct(score: number, max: number) {
    return `${Math.round((score / max) * 100)}%`;
  }

  const rows = audits.map((a) => [
    new Date(a.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    gradeBadge(a.score),
    pct(a.llmsScore, 25),
    pct(a.schemaScore, 25),
    pct(a.robotsScore, 15),
    pct(a.qualityScore, 20),
    pct(a.agentScore, 15),
  ]);

  if (audits.length === 0) {
    return (
      <Page title="Audit History">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No audits yet"
                action={{
                  content: "Run your first audit",
                  onAction: () => navigate("/app/audit"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Run your first AI Readiness Audit to see how visible your store is to AI engines.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Audit History"
      subtitle={`${audits.length} audit${audits.length !== 1 ? "s" : ""} run`}
      primaryAction={{
        content: "Run new audit",
        onAction: () => navigate("/app/audit"),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <DataTable
              columnContentTypes={[
                "text", "text", "text", "text", "text", "text", "text",
              ]}
              headings={[
                "Date",
                "Overall score",
                "llms.txt",
                "Schema",
                "robots.txt",
                "Product quality",
                "agent.json",
              ]}
              rows={rows}
            />
          </Card>
        </Layout.Section>

        {/* Score trend note */}
        {audits.length >= 2 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text variant="bodyMd" as="p">
                    Score trend: {" "}
                    {audits[0].score > audits[1].score ? (
                      <Text as="span" tone="success">↑ Improving (+{audits[0].score - audits[1].score} points)</Text>
                    ) : audits[0].score < audits[1].score ? (
                      <Text as="span" tone="critical">↓ Declining ({audits[0].score - audits[1].score} points)</Text>
                    ) : (
                      <Text as="span" tone="subdued">→ No change</Text>
                    )}
                  </Text>
                  <Text variant="bodySm" tone="subdued">
                    vs previous audit
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
