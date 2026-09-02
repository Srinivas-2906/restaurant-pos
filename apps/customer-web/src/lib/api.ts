const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function fetchPublicOutlet(slug: string) {
  const res = await fetch(`${API_URL}/public/outlets/${slug}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Outlet not found");
  return res.json() as Promise<{ id: string; name: string; code: string; city?: string; phone?: string }>;
}

export async function createPublicReservation(slug: string, body: {
  guestName: string;
  guestPhone: string;
  guestCount: number;
  date: string;
  occasion?: string;
  specialRequest?: string;
}) {
  const res = await fetch(`${API_URL}/public/outlets/${slug}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Booking failed" }));
    throw new Error(err.error || err.message || "Booking failed");
  }
  return res.json() as Promise<{ id: string; guestName: string; date: string; guestCount: number }>;
}

export const TIME_SLOTS = [
  "12:00", "12:30", "13:00", "13:30", "14:00",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
];
