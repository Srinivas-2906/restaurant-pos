"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createPublicReservation, fetchPublicOutlet, TIME_SLOTS } from "@/lib/api";

function BrandMark({ label }: { label?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "inline-flex", background: "#000", borderRadius: 12, padding: "8px 14px" }}>
        <img src="/kaana-logo.png" alt="Kaana Kitchens" style={{ height: 40, width: "auto", maxWidth: "100%", objectFit: "contain" }} />
      </div>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", margin: "8px 0 0" }}>
          {label}
        </p>
      )}
    </div>
  );
}

export default function BookPage() {
  const params = useParams();
  const slug = params.outletSlug as string;

  const [outlet, setOutlet] = useState<{ name: string; city?: string } | null>(null);
  const [step, setStep] = useState<"form" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ id: string; date: string } | null>(null);

  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    guestCount: 2,
    date: "",
    time: "19:00",
    occasion: "",
    specialRequest: "",
  });

  useEffect(() => {
    fetchPublicOutlet(slug)
      .then(setOutlet)
      .catch(() => setError("Restaurant not found"));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const dateTime = new Date(`${form.date}T${form.time}:00`).toISOString();
      const result = await createPublicReservation(slug, {
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        guestCount: Number(form.guestCount),
        date: dateTime,
        occasion: form.occasion || undefined,
        specialRequest: form.specialRequest || undefined,
      });
      setConfirmation({ id: result.id, date: result.date });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete booking");
    } finally {
      setBusy(false);
    }
  }

  const minDate = new Date().toISOString().slice(0, 10);

  if (step === "done" && confirmation) {
    return (
      <main style={styles.main}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.title}>Booking confirmed</h1>
          <p style={styles.subtitle}>{outlet?.name}</p>
          <p style={styles.ref}>Ref: {confirmation.id.slice(-8).toUpperCase()}</p>
          <p style={styles.detail}>
            {new Date(confirmation.date).toLocaleString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          <p style={styles.hint}>We look forward to seeing you. A confirmation may be sent to your phone.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={{ ...styles.header, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <BrandMark label="Reservations" />
        <h1 style={styles.title}>{outlet?.name ?? "Book a table"}</h1>
        {outlet?.city && <p style={styles.subtitle}>{outlet.city}</p>}
      </div>

      <form onSubmit={submit} style={styles.card}>
        {error && <p style={styles.error}>{error}</p>}

        <label style={styles.label}>
          Your name
          <input required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} style={styles.input} />
        </label>

        <label style={styles.label}>
          Mobile number
          <input required minLength={10} type="tel" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} style={styles.input} placeholder="10-digit mobile" />
        </label>

        <label style={styles.label}>
          Guests
          <select value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} style={styles.input}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Date
          <input required type="date" min={minDate} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={styles.input} />
        </label>

        <label style={styles.label}>
          Time
          <select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={styles.input}>
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Occasion (optional)
          <input value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} style={styles.input} placeholder="Birthday, anniversary…" />
        </label>

        <label style={styles.label}>
          Special request (optional)
          <textarea value={form.specialRequest} onChange={(e) => setForm({ ...form, specialRequest: e.target.value })} style={{ ...styles.input, minHeight: 72 }} rows={3} />
        </label>

        <button type="submit" disabled={busy || !outlet} style={styles.button}>
          {busy ? "Booking…" : "Confirm booking"}
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100dvh",
    background: "linear-gradient(165deg, #faf5ff 0%, #f4f6f5 100%)",
    padding: "24px 16px calc(48px + env(safe-area-inset-bottom))",
    fontFamily: "system-ui, -apple-system, sans-serif",
    overflowX: "clip",
    width: "100%",
    boxSizing: "border-box",
  },
  header: { textAlign: "center", marginBottom: 24 },
  brand: { fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.08em", textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "8px 0 4px" },
  subtitle: { fontSize: 14, color: "#64748b" },
  card: {
    maxWidth: 420,
    width: "100%",
    margin: "0 auto",
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 4px 24px rgb(0 0 0 / 0.06)",
    boxSizing: "border-box",
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 16 },
  input: {
    display: "block",
    width: "100%",
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 16,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  error: { color: "#dc2626", fontSize: 14, marginBottom: 12 },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "#dcfce7",
    color: "#16a34a",
    fontSize: 28,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  ref: { fontSize: 13, color: "#7c3aed", fontWeight: 700, textAlign: "center" },
  detail: { fontSize: 16, color: "#334155", textAlign: "center", marginTop: 8 },
  hint: { fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 16 },
};
