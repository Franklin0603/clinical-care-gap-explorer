"use client";

import { ReactNode, useState } from "react";
import {
  ColumnDef, ColumnFiltersState, SortingState, VisibilityState,
  flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues,
  getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
} from "@tanstack/react-table";

import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./DataTablePagination";

/**
 * A sortable, filterable, paginated table.
 *
 * `toolbar` is a render prop rather than a component so the page can own which
 * filters exist without this file knowing anything about patients.
 */
export function DataTable<TData>({
  columns, data, toolbar, onRowClick, initialSorting = [], initialHidden = {},
  noun = "row", empty = "Nothing matches those filters.",
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  toolbar?: (table: ReturnType<typeof useReactTable<TData>>) => ReactNode;
  onRowClick?: (row: TData) => void;
  initialSorting?: SortingState;
  initialHidden?: VisibilityState;
  noun?: string;
  empty?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialHidden);
  const [globalFilter, setGlobalFilter] = useState("");

  // react-hooks/incompatible-library warns here: TanStack keeps its own store
  // and mutates it, which the React Compiler cannot reason about, so it skips
  // optimising this component. That is correct and expected, not a defect to
  // chase - the table re-renders on its own state changes either way.
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className="flex flex-col gap-3">
      {toolbar?.(table)}
      <Card className="overflow-auto p-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      <DataTablePagination table={table} noun={noun} />
    </div>
  );
}
