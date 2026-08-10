import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Button } from "./button";
import { EmptyState, ErrorState, LoadingState, type ContentStatus } from "./feedback";
import { V2Icon } from "./icons";

export interface DataTableColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  role?: "identity" | "text" | "status" | "date" | "number";
  sort?: { href: string; direction?: "ascending" | "descending"; label: string };
}

export interface DataTableSearch {
  action: string;
  label: string;
  placeholder: string;
  parameter?: string;
  defaultValue?: string;
}

export interface DataTableProps<Row> {
  caption: string;
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  getRowKey: (row: Row) => string;
  getRowHref: (row: Row) => string;
  getRowLabel: (row: Row) => string;
  search?: DataTableSearch;
  state?: ContentStatus;
  empty: { title: string; description: string };
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  getRowHref,
  getRowLabel,
  search,
  state = { status: "ready" },
  empty,
}: DataTableProps<Row>) {
  const searchId = useId();
  const status = state.status ?? "ready";
  const effectiveState: ContentStatus = status === "ready"
    ? rows.length === 0
      ? { status: "empty", ...empty }
      : { status: "ready" }
    : state;

  return (
    <section className="v2-data-table" data-v2-elevation="0">
      {search ? (
        <form action={search.action} className="v2-table-search" method="get" role="search">
          <label htmlFor={searchId}>{search.label}</label>
          <div>
            <input
              defaultValue={search.defaultValue}
              id={searchId}
              name={search.parameter ?? "q"}
              placeholder={search.placeholder}
              type="search"
            />
            <Button icon="search" type="submit" variant="secondary">Search</Button>
          </div>
        </form>
      ) : null}

      {effectiveState.status === "loading" ? <LoadingState label={effectiveState.label ?? `Loading ${caption}`} rows={4} /> : null}
      {effectiveState.status === "empty" ? <EmptyState description={effectiveState.description} title={effectiveState.title} /> : null}
      {effectiveState.status === "error" ? <ErrorState description={effectiveState.description} recovery={effectiveState.recovery} title={effectiveState.title} /> : null}

      {effectiveState.status === "ready" ? (
        <div
          aria-label={`${caption} table, scroll horizontally when needed`}
          data-v2-scroll-region="table"
          role="region"
          tabIndex={0}
        >
          <table>
            <caption className="v2-visually-hidden">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    aria-sort={column.sort?.direction}
                    data-v2-column={column.role ?? "text"}
                    key={column.id}
                    scope="col"
                  >
                    {column.sort ? (
                      <Link aria-label={column.sort.label} href={column.sort.href}>
                        <span>{column.header}</span>
                        <V2Icon name="sort" />
                      </Link>
                    ) : column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = getRowHref(row);
                return (
                  <tr key={getRowKey(row)}>
                    {columns.map((column, columnIndex) => (
                      <td data-v2-column={column.role ?? "text"} key={column.id}>
                        <Link
                          aria-hidden={columnIndex === 0 ? undefined : true}
                          aria-label={columnIndex === 0 ? getRowLabel(row) : undefined}
                          href={href}
                          tabIndex={columnIndex === 0 ? undefined : -1}
                        >
                          {column.cell(row)}
                        </Link>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
