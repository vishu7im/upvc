"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconButton } from "./button";
import { V2Icon, type V2IconName } from "./icons";

export type ToastTone = "neutral" | "success" | "warning" | "error";

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, "id">) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ReadonlyArray<ToastMessage>;
  onDismiss: (id: number) => void;
}) {
  return (
    <div aria-label="Notifications" className="v2-toast-viewport">
      {toasts.map((toast) => {
        const icon: V2IconName = toast.tone === "success" ? "check" : toast.tone === "warning" || toast.tone === "error" ? "warning" : "info";
        return (
          <div
            className="v2-toast"
            data-v2-elevation="2"
            data-v2-tone={toast.tone}
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <V2Icon name={icon} />
            <div>
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <IconButton icon="close" label={`Dismiss ${toast.title}`} onClick={() => onDismiss(toast.id)} tooltip="Dismiss" />
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { ...toast, id }]);
    if (toast.tone !== "error") window.setTimeout(() => dismissToast(id), 6000);
    return id;
  }, [dismissToast]);

  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
