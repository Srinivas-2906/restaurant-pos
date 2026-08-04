export default function DeveloperPortal() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: 32, fontFamily: "system-ui" }}>
      <h1 style={{ color: "#ea580c" }}>Kaana Developer Portal</h1>
      <p>Public REST API, webhooks, sandbox, and SDK stubs for restaurant integrations.</p>

      <section style={{ marginTop: 32 }}>
        <h2>Quick Start</h2>
        <pre style={{ background: "#111", color: "#0f0", padding: 16, borderRadius: 8, overflow: "auto" }}>
{`curl http://localhost:4000/api/developer/sandbox

# Create API key (owner auth required)
curl -X POST http://localhost:4000/api/developer/api-keys?outletId=YOUR_OUTLET \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"name":"My Integration","scopes":["orders:read","orders:write"]}'`}
        </pre>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Webhooks</h2>
        <p>Subscribe to: <code>order.created</code>, <code>order.settled</code>, <code>payment.completed</code>, <code>inventory.low_stock</code></p>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>SDKs</h2>
        <ul>
          <li><strong>JavaScript:</strong> <code>@kaana/sdk-js</code></li>
          <li><strong>Python:</strong> <code>kaana-sdk</code></li>
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Sandbox</h2>
        <p>Use demo outlet credentials from seed data. API docs at <a href="http://localhost:4000/api/docs">/api/docs</a></p>
      </section>
    </main>
  );
}
