"use client";

import { ErrorState, PageFrame } from "@/components/v2";

export default function V2Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-v2>
      <PageFrame width="detail">
        <ErrorState
          description="The current V2 workspace could not be rendered. Your session and V1 routes are unchanged."
          recovery={{ label: "Try again", onSelect: reset }}
          title="Workspace unavailable"
        />
      </PageFrame>
    </div>
  );
}
