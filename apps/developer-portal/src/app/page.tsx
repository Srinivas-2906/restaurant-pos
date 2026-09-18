import { KaanaBrand } from "@kaana/ui";

export default function DeveloperPortal() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12 min-h-dvh safe-top safe-bottom">
      <KaanaBrand size="md" framed appLabel="Developer Portal" className="mb-6" labelClassName="text-gray-500" />
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 text-balance">Developer Portal</h1>
      <p className="mt-2 text-gray-600 text-balance">
        Public REST API, webhooks, sandbox, and SDK stubs for restaurant integrations.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Quick start</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-emerald-400">
{`curl http://localhost:4000/api/developer/sandbox

# Create API key (owner auth required)
curl -X POST http://localhost:4000/api/developer/api-keys?outletId=YOUR_OUTLET \\
  -H "Authorization: Bearer TOKEN" \\
  -d '{"name":"My Integration","scopes":["orders:read","orders:write"]}'`}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Webhooks</h2>
        <p className="mt-2 text-gray-600">
          Subscribe to: <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">order.created</code>,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">order.settled</code>,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">payment.completed</code>,{" "}
          <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">inventory.low_stock</code>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">SDKs</h2>
        <ul className="mt-2 list-disc pl-5 text-gray-600 space-y-1">
          <li>
            <strong className="text-gray-800">JavaScript:</strong> @kaana/sdk-js
          </li>
          <li>
            <strong className="text-gray-800">Python:</strong> kaana-sdk
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-gray-900">Sandbox</h2>
        <p className="mt-2 text-gray-600">
          Use demo outlet credentials from seed data. API docs at{" "}
          <a href="http://localhost:4000/api/docs" className="font-medium text-kaana hover:text-kaana-dark">
            /api/docs
          </a>
        </p>
      </section>
    </main>
  );
}
