import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CheckboxField,
  Cluster,
  DataTable,
  Drawer,
  EmptyState,
  Grid,
  Header,
  LoadingState,
  MetricCard,
  PageFrame,
  PageHeading,
  Section,
  SelectField,
  Sidebar,
  Skeleton,
  Stack,
  StatusChip,
  TextAreaField,
  TextField,
  ToastViewport,
} from "./index";

const records = [
  { id: "A-104", client: "North workshop", state: "Ready", created: "7 Aug 2026", amount: "£1,240.00" },
  { id: "A-103", client: "Riverside project", state: "Needs review", created: "6 Aug 2026", amount: "£860.00" },
];

const columns = [
  { id: "record", header: "Record", role: "identity" as const, cell: (row: typeof records[number]) => <strong>{row.id}</strong>, sort: { href: "gallery.html?sort=record", label: "Sort by record" } },
  { id: "client", header: "Client", cell: (row: typeof records[number]) => row.client },
  { id: "state", header: "State", role: "status" as const, cell: (row: typeof records[number]) => <StatusChip label={row.state} tone={row.state === "Ready" ? "success" : "warning"} /> },
  { id: "created", header: "Created", role: "date" as const, cell: (row: typeof records[number]) => row.created },
  { id: "amount", header: "Amount", role: "number" as const, cell: (row: typeof records[number]) => row.amount },
];

const noop = () => undefined;

export function ComponentGallery({ showDrawer = false }: { showDrawer?: boolean }) {
  return (
    <div data-v2>
      <PageFrame width="wide">
        <PageHeading
          actions={<ButtonLink href="#collections">Review collections</ButtonLink>}
          description="Actual Phase 4 components rendered together in their finite states."
          eyebrow="Approval specimen"
          title="V2 component library"
        />

        <Section description="Finite variants, loading behaviour, and the isolated icon set." title="Actions and feedback">
          <Stack gap="card">
            <Cluster>
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary action</Button>
              <Button variant="ghost">Quiet action</Button>
              <Button variant="danger">Destructive action</Button>
              <Button loading loadingLabel="Saving">Save</Button>
              <Button disabled>Unavailable</Button>
            </Cluster>
            <Grid columns="two">
              <Alert title="Saved" tone="success">The server accepted the change.</Alert>
              <Alert title="Check this value" tone="warning">A required choice still needs attention.</Alert>
              <Alert title="Could not load" tone="error">Try again; the last good value remains visible.</Alert>
              <Alert title="Helpful context">This message explains the next step.</Alert>
            </Grid>
            <Cluster>
              <StatusChip label="Current" />
              <StatusChip label="Complete" tone="success" />
              <StatusChip label="Attention" tone="warning" />
              <StatusChip label="Blocked" tone="error" />
            </Cluster>
          </Stack>
        </Section>

        <Section description="The four answer states are expressed only through state.tsx." title="Field and state grammar">
          <Grid columns="two">
            <TextField hint="A persistent instruction." label="Default value" defaultValue="Saved answer" />
            <TextField label="Changed value" defaultValue="New answer" onReset={noop} state="changed" />
            <SelectField label="Required choice" options={[{ value: "", label: "Choose" }]} placeholder="Choose an answer" state="attention" stateMessage="Choose an answer before continuing." />
            <TextField label="Invalid value" defaultValue="Invalid" state="error" stateMessage="Use a value accepted by the server, then retry." />
            <TextField defaultValue="1200" inputMode="decimal" label="Value with unit" unit="mm" />
            <CheckboxField hint="The label supplies a 44 px target." label="Include this choice" />
            <TextAreaField label="Notes" rows={3} defaultValue="Plain language, with enough room to read." />
          </Grid>
        </Section>

        <Section description="Ready, loading, empty, and error are first-class content states." title="Cards and content states">
          <Grid columns="three">
            <MetricCard context="From a server response" label="Ready records" value="18" />
            <MetricCard label="Loading records" state={{ status: "loading", label: "Loading metric" }} value="—" />
            <MetricCard label="Unavailable records" state={{ status: "error", title: "Metric unavailable", description: "The source did not respond.", recovery: { label: "Retry", onSelect: noop } }} value="—" />
          </Grid>
          <Grid columns="two">
            <Card description="A standard raised surface." title="Ready card"><p>Cards hold one coherent concern and do not nest other cards.</p></Card>
            <Card state={{ status: "empty", title: "Nothing here yet", description: "Use the primary task when you are ready." }} title="Empty card"><span /></Card>
            <Card state={{ status: "loading", label: "Loading card" }} title="Loading card"><span /></Card>
            <Card state={{ status: "error", title: "Card failed to load", description: "Retry from this bounded region.", recovery: { label: "Retry", onSelect: noop } }} title="Error card"><span /></Card>
          </Grid>
        </Section>

        <Section description="Columns are data; search and sort submit to supplied server URLs." title="Data table" actions={<span className="v2-metadata">One keyboard row destination</span>}>
          <div id="collections">
            <DataTable
              caption="Example records"
              columns={columns}
              empty={{ title: "No records", description: "Change the server filters or create the first record." }}
              getRowHref={(row) => `#record-${row.id}`}
              getRowKey={(row) => row.id}
              getRowLabel={(row) => `${row.id}, ${row.client}, ${row.state}, ${row.created}, ${row.amount}`}
              rows={records}
              search={{ action: "gallery.html", label: "Search specimen records", placeholder: "Search specimen records" }}
            />
          </div>
          <Grid columns="three">
            <DataTable caption="Loading collection" columns={columns} empty={{ title: "No records", description: "None available." }} getRowHref={() => "#"} getRowKey={(row) => row.id} getRowLabel={(row) => row.id} rows={[]} state={{ status: "loading", label: "Loading collection" }} />
            <DataTable caption="Empty collection" columns={columns} empty={{ title: "No records yet", description: "The first record will appear here." }} getRowHref={() => "#"} getRowKey={(row) => row.id} getRowLabel={(row) => row.id} rows={[]} />
            <DataTable caption="Failed collection" columns={columns} empty={{ title: "No records", description: "None available." }} getRowHref={() => "#"} getRowKey={(row) => row.id} getRowLabel={(row) => row.id} rows={[]} state={{ status: "error", title: "Could not load records", description: "The server response was unavailable.", recovery: { label: "Retry", href: "gallery.html" } }} />
          </Grid>
        </Section>

        <Section description="Both receive only supplied data and working destinations." title="Shell parts">
          <div className="v2-gallery-shell">
            <Sidebar
              activeHref="#foundations"
              brand={{ name: "Fabricator OS", descriptor: "V2 specimen" }}
              sections={[
                { id: "work", label: "Work", items: [{ id: "foundations", label: "Foundations", href: "#foundations" }, { id: "collections", label: "Collections", href: "#collections" }] },
                { id: "manage", label: "Manage", items: [{ id: "feedback", label: "Feedback", href: "#feedback", marker: "Preview" }] },
              ]}
              versionLink={{ label: "View previous interface", href: "#foundations" }}
            />
            <div>
              <Header
                breadcrumbs={[{ label: "Library", href: "#foundations" }, { label: "Components" }]}
                notifications={{ count: 2, href: "#feedback", label: "Review notices" }}
                primaryAction={{ href: "#collections", label: "Review table" }}
                profile={{ href: "#feedback", label: "Open specimen profile", name: "Workshop Owner", context: "Approval view" }}
                search={{ action: "gallery.html", label: "Search specimen", placeholder: "Search specimen" }}
              />
              <div className="v2-gallery-shell-content" id="foundations">
                <EmptyState description="The shell keeps its content region calm and task-shaped." title="Shell content area" />
              </div>
            </div>
          </div>
        </Section>

        <Section description="Static loading, a focus-managed drawer, and readable notifications." title="Overlays and loading">
          <div id="feedback">
            <Grid columns="two">
              <LoadingState label="Loading detail" rows={3} />
              <Stack gap="related"><Skeleton shape="text" /><Skeleton shape="block" /><Skeleton shape="circle" /></Stack>
            </Grid>
            <div className="v2-toast-preview">
              <ToastViewport onDismiss={noop} toasts={[
                { id: 1, tone: "success", title: "Change saved", description: "The server accepted the update." },
                { id: 2, tone: "error", title: "Update failed", description: "Review the reason and retry." },
              ]} />
            </div>
            <Drawer description="Drawers preserve the page context and trap keyboard focus while open." footer={<Cluster><Button variant="secondary">Cancel</Button><Button>Apply</Button></Cluster>} onClose={noop} open={showDrawer} title="Review detail">
              <TextField label="Drawer field" defaultValue="Context retained" />
            </Drawer>
          </div>
        </Section>
      </PageFrame>
    </div>
  );
}
