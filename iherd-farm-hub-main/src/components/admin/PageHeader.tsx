import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const content = actions || children;
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between sm:items-center mb-6">
      <div className="min-w-0">
        <h1 className="truncate text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {content && <div className="flex items-center gap-2 shrink-0">{content}</div>}
    </header>
  );
}
