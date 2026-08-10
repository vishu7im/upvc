import { EmptyState, PageFrame, PageHeading, Section } from "@/components/v2";

export function RouteScaffold({
  description,
  phase,
  title,
  v1Href,
}: {
  description: string;
  phase: 6 | 7;
  title: string;
  v1Href: string;
}) {
  return (
    <PageFrame width="detail">
      <PageHeading
        description={description}
        eyebrow={`Phase ${phase} route scaffold`}
        title={title}
      />
      <Section title="Available during migration">
        <EmptyState
          action={{ href: v1Href, label: "Open this workspace in V1" }}
          description={`The V2 shell and permission guard are live. This screen's full workflow arrives in Phase ${phase}; use the unchanged V1 screen today.`}
          icon="info"
          title="Route ready, workflow still in V1"
        />
      </Section>
    </PageFrame>
  );
}
