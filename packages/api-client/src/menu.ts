import type { ApiClient } from "./http";

export type MenuApiCategory = {
  id: string;
  name: string;
  items?: Array<{
    id: string;
    name: string;
    basePrice?: number | string;
    price?: number | string;
    isAvailable?: boolean;
    isVeg?: boolean;
  }>;
};

export type MenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    basePrice: number | string;
    isAvailable?: boolean;
    isVeg?: boolean;
  }>;
};

type MenuApiResponse = Array<
  | (MenuCategory & { categories?: never })
  | { id: string; name: string; categories?: MenuApiCategory[] }
>;

export type { MenuApiResponse };

export function createMenuApi(client: ApiClient) {
  return {
    async fetchMenu(outletId: string) {
      const raw = await client.api<MenuApiResponse>(`/outlets/${outletId}/menu`);
      return normalizeMenuCategories(raw);
    },
  };
}

export function normalizeMenuCategories(raw: MenuApiResponse): MenuCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if ("categories" in raw[0] && Array.isArray(raw[0].categories)) {
    return (raw as Array<{ categories?: MenuApiCategory[] }>).flatMap((menu) =>
      (menu.categories ?? []).map((cat) => ({
        id: cat.id,
        name: cat.name,
        items: (cat.items ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          basePrice: item.price ?? item.basePrice ?? 0,
          isAvailable: item.isAvailable,
          isVeg: item.isVeg,
        })),
      })),
    );
  }

  return (raw as MenuCategory[]).map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: (cat.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      basePrice: item.basePrice ?? 0,
      isAvailable: item.isAvailable,
      isVeg: item.isVeg,
    })),
  }));
}
