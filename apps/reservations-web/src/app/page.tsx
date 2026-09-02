"use client";

import { Suspense, useLayoutEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { applyAuthHandoffFromSearchParams } from "@kaana/role-shells";
import { OutletBootstrap } from "@/components/OutletBootstrap";
import { RoleAppShell } from "@/components/RoleAppShell";
import { ReservationsApp } from "@/components/ReservationsApp";

function ReservationsPageInner() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (searchParams) applyAuthHandoffFromSearchParams(searchParams);
    setReady(true);
  }, [searchParams]);

  if (!ready) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <OutletBootstrap />
      <RoleAppShell
        title="Kaana Kitchens Reservations"
        badge="Front Desk"
        subtitle="Table bookings & waitlist"
      >
        <ReservationsApp />
      </RoleAppShell>
    </>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      }
    >
      <ReservationsPageInner />
    </Suspense>
  );
}
