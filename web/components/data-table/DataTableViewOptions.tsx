"use client";

import { Table } from "@tanstack/react-table";
import { Check, Settings2 } from "lucide-react";

import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Column visibility.
 *
 * The items live inside a RadioGroup purely to satisfy Base UI: GroupLabel
 * throws outside a Group or RadioGroup, which is what silently emptied the role
 * menu on this page before. The group has no value, so nothing is ever checked.
 */
export function DataTableViewOptions<TData>({
  table, labels,
}: { table: Table<TData>; labels?: Record<string, string> }) {
  const columns = table
    .getAllColumns()
    .filter((c) => typeof c.accessorFn !== "undefined" && c.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Settings2 className="size-3.5" />
            <span className="hidden sm:inline">Columns</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup value="">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Show
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((column) => {
            const on = column.getIsVisible();
            return (
              <DropdownMenuItem
                key={column.id}
                closeOnClick={false}
                onClick={() => column.toggleVisibility(!on)}
              >
                <Check className={cn("size-3.5", !on && "invisible")} />
                {labels?.[column.id] ?? column.id}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
