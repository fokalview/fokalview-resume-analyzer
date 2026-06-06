import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="experience-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        {meta && <div className="experience-header-meta">{meta}</div>}
      </div>
      {actions && <div className="experience-header-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  detail,
  action
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="experience-empty">
      <span><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function InlineNotice({
  tone = "info",
  title,
  children
}: {
  tone?: "info" | "success" | "warning";
  title: string;
  children: ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? TriangleAlert : Info;
  return (
    <div className={`inline-notice ${tone}`} role={tone === "warning" ? "alert" : "status"}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

export function Toast({
  message,
  tone = "success",
  onDismiss
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div className={`app-toast ${tone}`} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      {tone === "success" ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X size={16} /></button>
    </div>
  );
}
