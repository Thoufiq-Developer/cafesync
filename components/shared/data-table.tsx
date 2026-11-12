'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { PAGE_SIZE } from '@/lib/calculations/financials';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  className?: string;
  headerClassName?: string;
  cell?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  totalCount: number;
  currentPage: number;
  pageSize?: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  totalCount,
  currentPage,
  pageSize = PAGE_SIZE,
  isLoading = false,
  onPageChange,
  emptyMessage = 'No records found',
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, currentPage * pageSize);

  return (
    <div className="w-full space-y-3">
      {/* Table Container */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead
                  key={idx}
                  className={col.headerClassName || 'text-xs font-semibold uppercase text-slate-500'}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary,#ea580c)]" />
                    <span className="text-xs">Loading records...</span>
                  </div>
                </TableCell>
              </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-sm text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-btn,0.5rem)] text-xs font-bold"
                        style={{
                          backgroundColor: 'var(--brand-100, #f1f5f9)',
                          color: 'var(--brand-ink, #64748b)',
                        }}
                      >
                        0
                      </span>
                      <span>{emptyMessage}</span>
                    </div>
                  </TableCell>
                </TableRow>
            ) : (
              data.map((row, rIdx) => (
                <TableRow key={rIdx} className="hover:bg-slate-50/80">
                  {columns.map((col, cIdx) => (
                    <TableCell key={cIdx} className={col.className || 'text-sm'}>
                      {col.cell
                        ? col.cell(row, rIdx)
                        : col.accessorKey
                        ? (row[col.accessorKey] as React.ReactNode)
                        : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-slate-600">
        <div>
          Showing <span className="font-semibold text-slate-900">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-900">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900">{totalCount}</span> entries (
          {pageSize} per page)
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || isLoading}
            title="First Page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-2 text-xs font-medium">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || isLoading}
            title="Last Page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

