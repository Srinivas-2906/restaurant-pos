"use client";



import type { ReactNode } from "react";

import Link from "next/link";



export interface DisabledFeatureRouteProps {

  featureLabel: string;

  reason?: string;

  supportHref?: string;

  /** @deprecated Use supportHref — settings is not for Kaana entitlement control */

  upgradeHref?: string;

  children?: ReactNode;

}



export function DisabledFeatureRoute({

  featureLabel,

  reason = "This feature is not enabled for your restaurant.",

  supportHref = "/support",

  upgradeHref,

  children,

}: DisabledFeatureRouteProps) {

  if (children) return <>{children}</>;



  const helpHref = upgradeHref ?? supportHref;



  return (

    <div className="min-h-[50vh] flex items-center justify-center p-8">

      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">

        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Feature unavailable</p>

        <h2 className="mt-2 text-xl font-bold text-gray-900">{featureLabel}</h2>

        <p className="mt-3 text-sm text-gray-600">{reason}</p>

        <p className="mt-2 text-xs text-gray-500">

          Contact your restaurant administrator or Kaana support if you need access.

        </p>

        <Link

          href={helpHref}

          className="mt-6 inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"

        >

          Contact support

        </Link>

      </div>

    </div>

  );

}


