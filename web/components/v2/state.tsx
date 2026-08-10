import type { ReactNode } from "react";
import { Button } from "./button";

export type V2ControlState = "default" | "changed" | "attention" | "error";

export type ControlStateProps =
  | { state?: "default"; stateMessage?: never; onReset?: never }
  | { state: "changed"; stateMessage?: string; onReset: () => void }
  | { state: "attention" | "error"; stateMessage: string; onReset?: never };

const labels: Record<V2ControlState, string> = {
  default: "Current value",
  changed: "Changed",
  attention: "Attention needed",
  error: "Error",
};

export function ControlStateBoundary({
  children,
  messageId,
  stateProps,
}: {
  children: ReactNode;
  messageId: string;
  stateProps: ControlStateProps;
}) {
  const state = stateProps.state ?? "default";
  const message = state === "changed" ? stateProps.stateMessage ?? "This value differs from the saved value." : stateProps.stateMessage;

  return (
    <div className="v2-control-state" data-v2-state={state}>
      {children}
      {state !== "default" ? (
        <div className="v2-state-message" data-v2-state-label id={messageId}>
          <span>
            <strong>{labels[state]}.</strong> {message}
          </span>
          {state === "changed" ? (
            <Button onClick={stateProps.onReset} variant="ghost">
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
