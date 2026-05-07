import { createFileRoute } from "@tanstack/react-router";
import { Key, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/settings/api-keys")({
  component: APIKeysPage,
  head: () => ({ meta: [{ title: "API Keys — McKesson Claims AI" }] }),
});

const PROVIDERS = [
  { name: "OpenAI API Key", key: "OPENAI_API_KEY", env: "OPENAI_API_KEY", available: false },
  { name: "Anthropic API Key", key: "ANTHROPIC_API_KEY", env: "ANTHROPIC_API_KEY", available: false },
  { name: "Google Gemini API Key", key: "GEMINI_API_KEY", env: "GEMINI_API_KEY", available: false },
];

function APIKeysPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">API Keys</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          API keys are stored securely on the backend. Never enter keys in the frontend.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-800">API keys are backend-only</p>
          <p className="mt-0.5 text-xs text-green-700">
            All LLM API keys should be stored as environment variables in the backend (
            <code className="font-mono">.env</code> file). They are never exposed to the browser or
            included in frontend code.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <div
            key={provider.key}
            className="rounded-xl border border-border bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{provider.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Backend env var: <code className="font-mono">{provider.env}</code>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Backend only
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="password"
                disabled
                placeholder="Configured via backend .env"
                className="flex-1 bg-transparent text-xs text-muted-foreground outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Backend .env Setup</h3>
        <div className="rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-300">
          <p className="text-slate-500"># backend/.env</p>
          <p className="mt-1">OPENAI_API_KEY=sk-...</p>
          <p>ANTHROPIC_API_KEY=sk-ant-...</p>
          <p>GEMINI_API_KEY=AIza...</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Backend .env integration is coming in a future release. The backend will proxy LLM
          requests securely.
        </p>
      </div>
    </div>
  );
}
