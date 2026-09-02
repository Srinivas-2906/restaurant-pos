"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PanelPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function PanelPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  className = "",
}: PanelPaginationProps) {
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className={`flex items-center justify-between gap-3 pt-3 mt-3 border-t border-gray-100 ${className}`}>
      <p className="text-xs text-gray-500">
        {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-gray-600 min-w-[4.5rem] text-center">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next page"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
