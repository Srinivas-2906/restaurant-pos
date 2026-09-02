"use client";

import { useEffect, useState } from "react";

export function usePaginatedSlice<T>(items: T[], pageSize: number, resetKey?: string | number | null) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(0);
  }, [items.length, pageSize, resetKey]);

  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems: items.length,
    pageSize,
    setPage,
    hasPrev: safePage > 0,
    hasNext: safePage < totalPages - 1,
    goPrev: () => setPage((p) => Math.max(0, p - 1)),
    goNext: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    showPagination: items.length > pageSize,
  };
}
