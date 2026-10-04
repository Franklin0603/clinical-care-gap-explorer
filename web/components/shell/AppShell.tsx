import { ReactNode } from "react";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Sidebar, global header, and the page.
 *
 * Its own component rather than inline in the root layout because the public
 * landing page will sit outside it. When that is built, the app routes move
 * into an (app) route group whose layout is this, and the landing page does not
 * inherit a sidebar. Doing that move now would have pushed the 404 page out of
 * the shell too, so it waits for the phase that needs it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={300}>
      {/* First thing a keyboard reaches. Without it, every page starts with a
          dozen navigation links before any content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-2 focus:outline-ring"
      >
        Skip to content
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset id="main-content" tabIndex={-1} className="min-w-0 outline-none">
          <AppHeader />
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
