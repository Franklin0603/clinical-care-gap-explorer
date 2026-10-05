"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { gold, patients } from "@/lib/data";
import { shortMrn } from "@/lib/cohort";
import { moduleBySlug } from "@/lib/learn";
import { longDate } from "@/lib/dates";
import { locate } from "./nav";
import { SyntheticDataBadge } from "./SyntheticDataBadge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/** The last crumb on a page below its nav item: "MRN dd31b260" on a patient
 *  record, the module title on a Learn module. Otherwise null. */
function recordCrumb(pathname: string | null) {
  const path = pathname ?? "";
  const m = /\/patients\/([^/]+)\/?$/.exec(path);
  if (m) {
    const r = patients.find((p) => String(p.patient_id) === decodeURIComponent(m[1]));
    return r ? `MRN ${shortMrn(r)}` : "Patient";
  }
  const l = /\/learn\/([^/]+)\/?$/.exec(path);
  if (l) return moduleBySlug(l[1])?.title ?? null;
  return null;
}

/**
 * The bar across the top of every route.
 *
 * Rendered by the layout rather than by each page, so it is present on routes
 * that do not use <Page> at all - the 404 and the error boundary. That matters
 * twice over: it is how the mobile menu button exists on those pages (they had
 * no way back into the navigation before), and it is how the synthetic-data
 * notice keeps the promise the old full-width banner made.
 */
export function AppHeader() {
  const pathname = usePathname();
  const here = locate(pathname);

  // Section > item > adopted page. Sections are groupings, not pages, so they
  // are text. The item is a link only when we are on one of its older pages.
  const crumbs: { label: string; href?: string; hideOnMobile?: boolean }[] = [];
  if (here.section) crumbs.push({ label: here.section.label, hideOnMobile: true });
  // A patient record sits under Patients: /patients/<id>/.
  const record = recordCrumb(pathname);
  if (here.item) {
    crumbs.push({
      label: here.item.label,
      href: here.legacy || record ? here.item.href : undefined,
    });
  }
  if (here.legacy) crumbs.push({ label: here.legacy.label });
  if (record) crumbs.push({ label: record });

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
      <SidebarTrigger className="-ml-1" />
      {/* data-vertical: prefix on purpose. The component sets
          data-vertical:self-stretch, which outranks a plain self-center, so a
          bare h-5 rendered as a 20px line pinned to the top edge. */}
      <Separator orientation="vertical" className="data-vertical:h-5 data-vertical:self-center" />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.length === 0 ? (
            <BreadcrumbItem>
              <BreadcrumbPage>Care Gap Explorer</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              const hide = c.hideOnMobile ? "hidden sm:inline-flex" : "";
              return (
                <Fragment key={`${c.label}-${i}`}>
                  <BreadcrumbItem className={hide}>
                    {last ? (
                      <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                    ) : c.href ? (
                      <BreadcrumbLink render={<Link href={c.href} />}>{c.label}</BreadcrumbLink>
                    ) : (
                      <span className="text-muted-foreground">{c.label}</span>
                    )}
                  </BreadcrumbItem>
                  {!last && <BreadcrumbSeparator className={hide} />}
                </Fragment>
              );
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex shrink-0 items-center gap-3">
        <span className="num hidden text-xs text-muted-foreground md:inline">
          Data through {longDate(gold.asof)}
        </span>
        <SyntheticDataBadge />
      </div>
    </header>
  );
}
