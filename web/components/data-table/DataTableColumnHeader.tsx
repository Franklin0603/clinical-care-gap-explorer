"use client";

import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** A sortable, hideable column header. Plain text when the column is neither. */
export function DataTableColumnHeader<TData, TValue>({
  column, title, className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn("text-xs font-medium", className)}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <div className={cn("flex items-center", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 gap-1 px-2 text-xs font-medium data-popup-open:bg-accent"
            >
              <span>{title}</span>
              {sorted === "desc" ? (
                <ArrowDown className="size-3.5" />
              ) : sorted === "asc" ? (
                <ArrowUp className="size-3.5" />
              ) : (
                <ChevronsUpDown className="size-3.5 opacity-40" />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-36">
          {column.getCanSort() && (
            <>
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUp className="size-3.5 text-muted-foreground" /> Ascending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDown className="size-3.5 text-muted-foreground" /> Descending
              </DropdownMenuItem>
            </>
          )}
          {column.getCanSort() && column.getCanHide() && <DropdownMenuSeparator />}
          {column.getCanHide() && (
            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
              <EyeOff className="size-3.5 text-muted-foreground" /> Hide
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
