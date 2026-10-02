"use client";

import { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";

import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
  CommandSeparator,
} from "@/components/ui/command";

/**
 * A multi-select filter chip, with live counts from the table's own facets.
 *
 * The counts matter more than they look: a filter that offers "hospice" without
 * saying it holds one patient invites a reader to draw a conclusion from n=1.
 */
export function DataTableFacetedFilter<TData, TValue>({
  column, title, options,
}: {
  column?: Column<TData, TValue>;
  title: string;
  options: { label: string; value: string; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  const facets = column?.getFacetedUniqueValues();
  const selected = new Set(column?.getFilterValue() as string[] | undefined);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-9 border-dashed">
            <PlusCircle className="size-3.5" />
            {title}
            {selected.size > 0 && (
              <>
                <Separator orientation="vertical" className="mx-1 h-4" />
                <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                  {selected.size}
                </Badge>
                <div className="hidden gap-1 lg:flex">
                  {selected.size > 2 ? (
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selected.size} selected
                    </Badge>
                  ) : (
                    options
                      .filter((o) => selected.has(o.value))
                      .map((o) => (
                        <Badge key={o.value} variant="secondary" className="rounded-sm px-1 font-normal">
                          {o.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) selected.delete(option.value);
                      else selected.add(option.value);
                      const next = Array.from(selected);
                      column?.setFilterValue(next.length ? next : undefined);
                    }}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      <Check className={cn("size-3", !isSelected && "invisible")} />
                    </div>
                    {option.icon && <option.icon className="size-4 text-muted-foreground" />}
                    <span>{option.label}</span>
                    {facets?.get(option.value) !== undefined && (
                      <span className="num ml-auto flex size-4 items-center justify-center font-mono text-xs">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
