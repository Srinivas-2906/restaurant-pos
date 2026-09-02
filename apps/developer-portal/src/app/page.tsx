export default function DeveloperPortal() {
  return (
    <main
      style={{
        maxWidth: 768,
        margin: "0 auto",
        padding: "32px 16px 48px",
        fontFamily: "system-ui, sans-serif",
        minHeight: "100dvh",
        overflowX: "clip",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          background: "#000",
          borderRadius: 12,
          padding: "8px 14px",
          marginBottom: 24,
        }}
      >
        <img src="/kaana-logo.png" alt="Kaana Kitchens" style={{ height: 48, width: "auto", maxWidth: "100%", objectFit: "contain" }} />
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", margin: "0 0 8px" }}>
        Developer Portal
      </p>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700, color: "#111", margin: 0 }}>
        Developer Portal
      </h1>
      <p style={{ color: "#4b5563", marginTop: 8 }}>
        Public REST API, webhooks, sandbox, and SDK stubs for restaurant integrations.
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Quick Start</h2>
        <pre
          style={{
            marginTop: 12,
            background: "#111",
            color: "#4ade80",
            padding: 16,
            borderRadius: 12,
            overflowX: "auto",
            fontSize: 13,
          }}
        >
{`curl http://localhost:4000/api/developer/sandbox

# Create API key (owner auth required)
curl -X POST http://localhost:4000/api/developer/api-keys?outletId=YOUR_OUTLET \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"name":"My Integration","scopes":["orders:read","orders:write"]}'`}
        </pre>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Webhooks</h2>
        <p style={{ color: "#4b5563", marginTop: 8 }}>
          Subscribe to: order.created, order.settled, payment.completed, inventory.low_stock
        </p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>SDKs</h2>
        <ul style={{ color: "#4b5563", marginTop: 8, paddingLeft: 20 }}>
          <li><strong>JavaScript:</strong> @kaana/sdk-js</li>
          <li><strong>Python:</strong> kaana-sdk</li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Sandbox</h2>
        <p style={{ color: "#4b5563", marginTop: 8 }}>
          Use demo outlet credentials from seed data. API docs at{" "}
          <a href="http://localhost:4000/api/docs" style={{ color: "#111" }}>
            /api/docs
          </a>
        </p>
      </section>
    </main>
  );
}
