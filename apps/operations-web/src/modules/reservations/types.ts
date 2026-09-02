export interface Reservation {
  id: string;
  outletId: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  date: string;
  status: string;
  source: string;
  notes?: string | null;
  occasion?: string | null;
  specialRequest?: string | null;
  preferredArea?: string | null;
  advancePayment?: number | null;
  tableId?: string | null;
  arrivedAt?: string | null;
  seatedAt?: string | null;
  table?: { id: string; number: string; name?: string | null } | null;
  order?: { id: string; orderNumber: string } | null;
}

export interface WaitlistEntry {
  id: string;
  outletId: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  quotedWaitMins?: number | null;
  notes?: string | null;
  status: string;
  position: number;
  notifiedAt?: string | null;
  reservation?: Reservation | null;
}

export interface FloorTable {
  id: string;
  number: string;
  name?: string | null;
  capacity: number;
  status: string;
  activeOrder?: unknown | null;
  activeReservation?: { id: string; guestName: string; guestCount: number; date: string; status: string } | null;
  upcomingReservation?: { id: string; guestName: string; guestCount: number; date: string; status: string } | null;
}

export interface FloorPlan {
  id: string;
  tables: FloorTable[];
}

export type TabId = "today" | "upcoming" | "calendar" | "waitlist" | "cancelled" | "floor";
