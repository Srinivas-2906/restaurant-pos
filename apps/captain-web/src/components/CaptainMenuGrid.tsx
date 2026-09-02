"use client";

import { useMemo, useState } from "react";
import type { MenuCategory } from "@/lib/api";
import { formatInr } from "@/lib/api";

export function CaptainMenuGrid({
  menu,
  onAdd,
  disabled,
}: {
  menu: MenuCategory[];
  onAdd: (itemId: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  const items = useMemo(() => {
    const flat = menu.flatMap((c) =>
      c.items.map((item) => ({ ...item, categoryName: c.name, categoryId: c.id })),
    );
    return flat.filter((item) => {
      if (item.isAvailable === false) return false;
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [menu, categoryId, query]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        placeholder="Search menu…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoryId("all")}
          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${categoryId === "all" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          All
        </button>
        {menu.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${categoryId === c.id ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onAdd(item.id)}
            className="text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-400 disabled:opacity-50"
          >
            <p className="text-sm font-medium text-slate-900 line-clamp-2">{item.name}</p>
            <p className="text-xs text-teal-700 mt-1">{formatInr(item.basePrice)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
