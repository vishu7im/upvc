"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./button";

export function Drawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const targets = [...panel.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])")];
      if (targets.length === 0) return;
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const v2Root = panel?.closest<HTMLElement>("[data-v2]");
    const previousLock = v2Root?.getAttribute("data-v2-scroll-locked");
    v2Root?.setAttribute("data-v2-scroll-locked", "true");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousLock === null) v2Root?.removeAttribute("data-v2-scroll-locked");
      else if (previousLock !== undefined) v2Root?.setAttribute("data-v2-scroll-locked", previousLock);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="v2-drawer-layer">
      <button aria-label="Close drawer" className="v2-drawer-backdrop" onClick={onClose} type="button" />
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="v2-drawer"
        data-v2-elevation="2"
        ref={panelRef}
        role="dialog"
      >
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton icon="close" label="Close drawer" onClick={onClose} tooltip="Close" />
        </header>
        <div className="v2-drawer-content">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </div>
    </div>
  );
}
