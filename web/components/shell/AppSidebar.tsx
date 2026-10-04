"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartPulse, UserRound } from "lucide-react";

import { cn } from "cn";
import { NAV_FOOTER, NAV_SECTIONS, NavItem, locate } from "./nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";

/**
 * Desktop: persistent, collapsible to an icon rail with ⌘B / Ctrl+B.
 * Under 768px: a Sheet opened from the header. Both behaviours come from the
 * shadcn sidebar; this file only decides what goes in it.
 */
export function AppSidebar() {
  const here = locate(usePathname());
  const { isMobile, setOpenMobile } = useSidebar();

  // The mobile Sheet does not close itself when a link inside it is followed,
  // which leaves the menu covering the page you just asked for.
  const close = () => { if (isMobile) setOpenMobile(false); };

  const entry = (item: NavItem, quiet = false) => {
    const active = here.item?.href === item.href;
    const Icon = item.icon;
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          render={<Link href={item.href} onClick={close} />}
          isActive={active}
          size={quiet ? "sm" : "default"}
          tooltip={item.count != null ? `${item.label} · ${item.count}` : item.label}
          className={cn(quiet && !active && "text-muted-foreground")}
        >
          <Icon aria-hidden />
          <span>{item.label}</span>
          {item.countLabel && <span className="sr-only">, {item.countLabel}</span>}
        </SidebarMenuButton>
        {item.count != null && (
          // Neutral, not red: a count in navigation is orientation, and a red
          // badge on every page would make the whole app read as an alarm.
          <SidebarMenuBadge aria-hidden className="num text-muted-foreground">
            {item.count}
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <Link
          href="/home"
          onClick={close}
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HeartPulse className="size-4" aria-hidden />
          </div>
          <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Care Gap Explorer</span>
            <span className="truncate text-xs text-muted-foreground">Diabetes Care</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => {
          const quiet = section.emphasis === "quiet";
          return (
            <SidebarGroup
              key={section.label}
              // Quiet sections sink to the bottom of the scroll area, away from
              // the care work, so System is findable without competing with it.
              className={cn(quiet && "mt-auto")}
            >
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{section.items.map((i) => entry(i, quiet))}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>{NAV_FOOTER.map((i) => entry(i, true))}</SidebarMenu>

        {/* Not a button: there is no account to open. It says so rather than
            showing a name, because a named user would imply a sign-in. */}
        <div className="flex items-center gap-2 px-1 py-1.5">
          <Avatar className="size-8">
            <AvatarFallback>
              <UserRound className="size-4 text-muted-foreground" aria-hidden />
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">Demo user</span>
            <span className="truncate text-xs text-muted-foreground">No sign-in in this demo</span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
