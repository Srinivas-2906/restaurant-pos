"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StaffLoginForm } from "@kaana/ui";
import { signup, setSelectedOutletId } from "@/lib/api";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SignupPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(email: string, password: string) {
    if (!restaurantName.trim() || !firstName.trim()) {
      throw new Error("Restaurant name and your first name are required.");
    }

    setError(null);
    try {
      const slug = restaurantSlug.trim() || slugify(restaurantName);
      const data = await signup({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        restaurantName: restaurantName.trim(),
        restaurantSlug: slug,
      });

      const outletId =
        data.user.roles?.find((r) => r.outletId)?.outletId ?? data.user.roles?.[0]?.outletId ?? null;
      if (outletId) setSelectedOutletId(outletId);

      router.push("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      throw err;
    }
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Start with Kaana Foods</h1>
          <p className="text-slate-600 text-sm">
            Create your restaurant account, first outlet, and enter Operations in a few steps.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Restaurant name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={restaurantName}
              onChange={(e) => {
                setRestaurantName(e.target.value);
                if (!restaurantSlug) setRestaurantSlug(slugify(e.target.value));
              }}
              placeholder="Kaana Kitchen"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">URL slug</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={restaurantSlug}
              onChange={(e) => setRestaurantSlug(slugify(e.target.value))}
              placeholder="kaana-kitchen"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Your first name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ravi"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Last name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Sharma"
            />
          </label>
        </div>

        <StaffLoginForm
          appName="Kaana Kitchens Operations"
          badge="Owner signup"
          tagline="Email and password for the owner account"
          hint="Operational staff do not sign up here — managers configure them later."
          accent="slate"
          onSubmit={handleSubmit}
        />

        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/" className="text-slate-800 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
