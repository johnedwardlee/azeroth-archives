import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

function storedExpansionState(storageKey: string, defaultExpanded: boolean) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null ? defaultExpanded : stored === "true";
  } catch {
    return defaultExpanded;
  }
}

export function CollapsiblePanel({ className = "", storageKey, eyebrow, title, summary, defaultExpanded = true, contained = false, children }: {
  className?: string;
  storageKey: string;
  eyebrow: string;
  title: ReactNode;
  summary: ReactNode;
  defaultExpanded?: boolean;
  contained?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(() => storedExpansionState(storageKey, defaultExpanded));
  const contentId = useId();

  function toggle() {
    setExpanded((current) => {
      const next = !current;
      try { window.localStorage.setItem(storageKey, String(next)); } catch { /* Local persistence is optional. */ }
      return next;
    });
  }

  return <section className={`${contained ? "collapsible-subsection" : "panel"} collapsible-panel ${className}`.trim()}>
    <button type="button" className="section-heading collapsible-heading" aria-expanded={expanded} aria-controls={contentId} onClick={toggle}>
      <span className="collapsible-heading-title"><span className="eyebrow">{eyebrow}</span><span className="collapsible-title">{title}</span></span>
      <span className="collapsible-heading-summary">{summary}<ChevronDown size={18} aria-hidden="true" /></span>
    </button>
    <div className="collapsible-content" id={contentId} hidden={!expanded}>{children}</div>
  </section>;
}
