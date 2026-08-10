import type { ReactNode } from "react";

export type V2IconName =
  | "arrow-right"
  | "bell"
  | "check"
  | "chevron-down"
  | "close"
  | "empty"
  | "info"
  | "menu"
  | "more"
  | "retry"
  | "search"
  | "sort"
  | "warning";

const paths: Record<V2IconName, ReactNode> = {
  "arrow-right": <path d="M5 12h14m-5-5 5 5-5 5" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  empty: <path d="M4 6h16v12H4zM8 10h8M8 14h5" />,
  info: <path d="M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  retry: <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />,
  search: <path d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />,
  sort: <path d="m8 7 4-4 4 4M12 3v18m4-4-4 4-4-4" />,
  warning: <path d="M12 4 3 20h18L12 4Zm0 5v5m0 3h.01" />,
};

export function V2Icon({ name }: { name: V2IconName }) {
  return (
    <svg
      aria-hidden="true"
      className="v2-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      {paths[name]}
    </svg>
  );
}
