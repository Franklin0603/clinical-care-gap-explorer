"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, LayoutDashboard, Workflow, Users, MessageSquare, Activity,
} from "lucide-react";

import { NAV } from "./nav";
import { gold } from "@/lib/data";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const ICONS = { BookOpen, LayoutDashboard, Workflow, Users, MessageSquare } as const;

export function AppSidebar() {
  const path = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Care Gap Explorer</span>
            <span className="truncate text-xs text-muted-foreground">Synthetic data</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS];
                const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>

                    {/* Subtasks show only for the section you are in — a sidebar
                        that expands everything at once stops being navigation. */}
                    {item.items && active && (
                      <SidebarMenuSub>
                        {item.items.map((sub) => (
                          <SidebarMenuSubItem key={sub.href}>
                            <SidebarMenuSubButton render={<Link href={sub.href} />}>
                              {sub.label}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t group-data-[collapsible=icon]:hidden">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">
            {gold.open_gaps} of {gold.cohort} overdue
          </div>
          <div className="num">as of {gold.asof}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
