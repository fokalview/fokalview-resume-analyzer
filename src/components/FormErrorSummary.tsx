import { useEffect, useRef, useState } from "react";

export function FormErrorSummary({ formId, message, attempt }: { formId: string; message: string; attempt: number }) {
  const summary = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    if (!message) return;
    const fields = document.getElementById(formId)?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[aria-invalid="true"]') || [];
    setLinks(Array.from(fields).map(field => ({ id: field.id, label: fieldLabel(field) })).filter(field => field.id));
    summary.current?.focus();
  }, [attempt, message, formId]);
  if (!message) return null;
  return <div className="form-error-summary wide-field" role="alert" tabIndex={-1} ref={summary}>
    <strong>{message}</strong>
    {links.length > 0 && <ul>{links.map(link => <li key={link.id}><a href={`#${link.id}`} onClick={event => {
      event.preventDefault(); const field = document.getElementById(link.id); field?.closest("details")?.setAttribute("open", ""); field?.focus();
    }}>{link.label}</a></li>)}</ul>}
  </div>;
}

function fieldLabel(field: HTMLInputElement | HTMLTextAreaElement) {
  const labelledBy = field.getAttribute("aria-labelledby")?.split(/\s+/)
    .map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
  if (labelledBy) return labelledBy.replace(/\*/g, "").trim();
  const explicitLabel = field.getAttribute("aria-label");
  if (explicitLabel) return explicitLabel;
  const label = field.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
  // Helper and error descriptions belong to aria-describedby, never the link name.
  label?.querySelectorAll('input, select, textarea, button, small, [aria-hidden="true"]').forEach(node => node.remove());
  return label?.textContent?.replace(/\*/g, "").trim() || "Review field";
}
