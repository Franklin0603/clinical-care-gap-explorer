"use client";

import { Table } from "@tanstack/react-table";
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SIZES = [10, 25, 50, 100];

export function DataTablePagination<TData>({
  table, noun = "row",
}: { table: Table<TData>; noun?: string }) {
  const filtered = table.getFilteredRowModel().rows.length;
  const total = table.getCoreRowModel().rows.length;
  const page = table.getState().pagination.pageIndex + 1;
  const pages = table.getPageCount();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-1">
      <div className="num text-sm text-muted-foreground">
        {filtered === total
          ? `${total} ${noun}${total === 1 ? "" : "s"}`
          : `${filtered} of ${total} ${noun}${total === 1 ? "" : "s"}`}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Rows per page</p>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v ?? 25))}
          >
            <SelectTrigger size="sm" className="w-[72px]">
              <SelectValue>{(v: string | null) => v ?? "25"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="num text-sm text-muted-foreground">
          Page {pages === 0 ? 0 : page} of {pages}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="icon" className="size-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline" size="icon" className="size-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline" size="icon" className="size-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline" size="icon" className="size-8"
            onClick={() => table.setPageIndex(pages - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
