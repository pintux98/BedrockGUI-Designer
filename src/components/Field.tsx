import React from "react";

export function Field({
  label,
  hint,
  children,
  className = ""
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="ui-label">{label}</span>
      {children}
      {hint && <span className="ui-hint block">{hint}</span>}
    </label>
  );
}

export function Section({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-brand-border px-4 py-4 first:border-t-0">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="ui-section-title">{title}</h3>
          {description && <p className="ui-hint mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
