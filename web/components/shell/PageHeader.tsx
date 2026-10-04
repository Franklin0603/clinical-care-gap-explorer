import { ReactNode } from "react";

/**
 * A page's title, what it is for, and its actions.
 *
 * In the page flow rather than sticky. The sticky part of the screen is now the
 * global AppHeader (navigation, breadcrumbs, data date), and a second sticky
 * band holding a title would spend a fifth of a laptop screen restating where
 * you are. The title used to be 14px inside that band; it is now the largest
 * text on the page, which is what a page title is for.
 */
export function PageHeader({
  title, description, actions,
}: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
