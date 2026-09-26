import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="max-w-md mx-auto px-4 py-12 md:py-16">
      <div className="card p-6 md:p-8 animate-in">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="text-center text-sm text-muted mt-4">{footer}</div>}
    </div>
  );
}
