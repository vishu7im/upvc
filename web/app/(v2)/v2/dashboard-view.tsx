import {
  Alert,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Grid,
  MetricCard,
  PageFrame,
  PageHeading,
  Section,
  Stack,
  StatusChip,
  type DataTableColumn,
} from "@/components/v2";
import { dateShort, money } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";
import type { DashboardData } from "@/lib/v2/dashboard-data";
import type {
  DashboardAudience,
  DashboardPrimaryAction,
} from "@/lib/v2/dashboard-model";

export type DashboardContent =
  | { status: "ready"; data: DashboardData }
  | { status: "permission-limited" }
  | { status: "error" };

const recentOrderColumns: ReadonlyArray<DataTableColumn<OrderSummary>> = [
  {
    id: "order",
    header: "Order",
    role: "identity",
    cell: (order) => order.orderNo,
  },
  {
    id: "customer",
    header: "Customer",
    cell: (order) => order.customerName,
  },
  {
    id: "status",
    header: "Status",
    role: "status",
    cell: (order) => (
      <StatusChip
        label={order.status === "confirmed" ? "Confirmed" : "Draft"}
        tone={order.status === "confirmed" ? "success" : "warning"}
      />
    ),
  },
  {
    id: "total",
    header: "Total",
    role: "number",
    cell: (order) => money(order.basketTotal ?? order.totalPrice),
  },
  {
    id: "created",
    header: "Created",
    role: "date",
    cell: (order) => dateShort(order.createdAt),
  },
];

function audienceCopy(audience: DashboardAudience): {
  eyebrow: string;
  description: string;
  overview: string;
} {
  if (audience === "organisation") {
    return {
      eyebrow: "Organisation workspace",
      description: "See organisation-wide order activity and move directly to your next permitted task.",
      overview: "Current draft and confirmed work across the organisation.",
    };
  }
  if (audience === "personal") {
    return {
      eyebrow: "Your workspace",
      description: "See your own order activity and move directly to your next permitted task.",
      overview: "Current draft and confirmed work assigned to you.",
    };
  }
  return {
    eyebrow: "Your workspace",
    description: "Your home shows only the tasks and information allowed by your current access.",
    overview: "Order activity is outside your current access.",
  };
}

export function DashboardHome({
  audience,
  content,
  incomingApprovals,
  primaryAction,
  userName,
}: {
  audience: DashboardAudience;
  content: DashboardContent;
  incomingApprovals: number;
  primaryAction: DashboardPrimaryAction | null;
  userName: string;
}) {
  const copy = audienceCopy(audience);

  return (
    <PageFrame width="wide">
      <PageHeading
        actions={primaryAction ? (
          <ButtonLink href={primaryAction.href}>
            {primaryAction.label}
          </ButtonLink>
        ) : undefined}
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={userName ? `Welcome, ${userName}` : "Home"}
      />

      <Stack gap="section">
        {incomingApprovals > 0 ? (
          <Alert title="Deletion approvals need review" tone="warning">
            <div className="v2-dashboard-alert-content">
              <p>{incomingApprovals} pending {incomingApprovals === 1 ? "request" : "requests"}.</p>
              <ButtonLink href="/v2/account" variant="secondary">Review in Account</ButtonLink>
            </div>
          </Alert>
        ) : null}

        {content.status === "permission-limited" ? (
          <Section title="Your next task">
            <EmptyState
              description="Order figures are hidden because your current access does not include reading orders. Use the permitted action above or choose a workspace from the navigation."
              icon="info"
              title="Order activity is not available"
            />
          </Section>
        ) : null}

        {content.status === "error" ? (
          <Section title="Order activity">
            <ErrorState
              description="The order service did not return a complete dashboard. No partial totals are shown."
              recovery={{ href: "/v2", label: "Try again" }}
              title="Order activity could not be loaded"
            />
          </Section>
        ) : null}

        {content.status === "ready" ? (
          content.data.draftCount + content.data.confirmedCount === 0 ? (
            <Section title="Start here">
              <EmptyState
                description="There are no orders in your current scope. Use the primary action above to begin the first permitted task."
                title="No orders yet"
              />
            </Section>
          ) : (
            <DashboardReady audienceOverview={copy.overview} data={content.data} />
          )
        ) : null}
      </Stack>
    </PageFrame>
  );
}

function DashboardReady({
  audienceOverview,
  data,
}: {
  audienceOverview: string;
  data: DashboardData;
}) {
  const peak = Math.max(...data.months.map((month) => month.value), 0);

  return (
    <>
      <Section description={audienceOverview} title="Order overview">
        <Grid columns="three">
          <MetricCard
            context="Current scoped workload"
            label="Draft orders"
            value={data.draftCount}
          />
          <MetricCard
            context="Current scoped workload"
            label="Confirmed orders"
            value={data.confirmedCount}
          />
          <MetricCard
            context="Server basket totals in the UTC window"
            label="Confirmed value · 6 months"
            value={money(data.confirmedValue)}
          />
        </Grid>
      </Section>

      <Section title="Confirmed order value">
        <Card
          description="Every scoped confirmed order in the last six UTC calendar months."
          state={peak === 0 ? {
            status: "empty",
            title: "Nothing to chart yet",
            description: "Confirm an order and its server basket total will appear in the matching month.",
          } : { status: "ready" }}
          title="Six-month trend"
        >
          <ol className="v2-dashboard-trend">
            {data.months.map((month) => (
              <li key={month.key}>
                <div>
                  <span>{month.label}</span>
                  <strong>{money(month.value)}</strong>
                </div>
                <progress
                  aria-label={`${month.label}: ${money(month.value)}`}
                  max={peak || 1}
                  value={month.value}
                >
                  {money(month.value)}
                </progress>
                <span>{month.count} {month.count === 1 ? "order" : "orders"}</span>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      <Section
        actions={<ButtonLink href="/v2/orders" variant="secondary">View all orders</ButtonLink>}
        description="The five newest orders in your current scope."
        title="Recent orders"
      >
        <DataTable
          caption="Recent orders"
          columns={recentOrderColumns}
          empty={{
            title: "No recent orders",
            description: "Orders will appear here after the first draft is created.",
          }}
          getRowHref={(order) => `/v2/orders/${order.id}`}
          getRowKey={(order) => order.id}
          getRowLabel={(order) => `Open order ${order.orderNo}`}
          rows={data.recentOrders}
        />
      </Section>
    </>
  );
}
