import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "#fff", background: "#111", minHeight: "100vh" }}>
      <h1>404</h1>
      <Link href="/" style={{ color: "#ea580c" }}>Back to POS</Link>
    </div>
  );
}
