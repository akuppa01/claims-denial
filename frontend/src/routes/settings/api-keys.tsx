import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Eye, EyeOff, Key, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings/api-keys")({
  component: APIKeysPage,
  head: () => ({ meta: [{ title: "API Keys — ASVA Group Claims AI" }] }),
});

type Provider = {
  id: string;
  name: string;
  storageKey: string;
  placeholder: string;
  prefix: string;
  model: string;
};

const PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    storageKey: "openai_api_key",
    placeholder: "sk-proj-…",
    prefix: "sk-",
    model: "GPT-4o mini",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    storageKey: "anthropic_api_key",
    placeholder: "sk-ant-…",
    prefix: "sk-ant-",
    model: "Claude 3.5 Haiku",
  },
];

function ProviderCard({ provider }: { provider: Provider }) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(provider.storageKey) ?? ""; } catch { return ""; }
  });
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(() => {
    try { return !!localStorage.getItem(provider.storageKey); } catch { return false; }
  });
  const [justSaved, setJustSaved] = useState(false);

  function save() {
    if (!value.trim()) return;
    localStorage.setItem(provider.storageKey, value.trim());
    setSaved(true);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  function remove() {
    localStorage.removeItem(provider.storageKey);
    setValue("");
    setSaved(false);
  }

  const maskedValue = value ? `${value.slice(0, 8)}${"•".repeat(Math.max(0, value.length - 12))}${value.slice(-4)}` : "";

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Key className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{provider.name} API Key</p>
            <p className="text-xs text-muted-foreground">Used for: {provider.model} in AI Analyst</p>
          </div>
        </div>
        <span
          className={
            saved
              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
              : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
          }
        >
          {saved ? "Configured" : "Not set"}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-400 transition-all">
        <input
          type={show ? "text" : "password"}
          value={show ? value : maskedValue || value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          placeholder={provider.placeholder}
          className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground"
          spellCheck={false}
        />
        <button
          onClick={() => setShow((v) => !v)}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? "Hide key" : "Show key"}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={save}
          disabled={!value.trim() || saved}
          className="gap-1.5 h-8 text-xs"
        >
          {justSaved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Key
            </>
          )}
        </Button>
        {saved && (
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            className="gap-1.5 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
        <p className="ml-auto text-[10px] text-muted-foreground">Stored in browser localStorage</p>
      </div>
    </div>
  );
}

function APIKeysPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">API Keys</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keys are saved locally in your browser and used directly by the AI Analyst.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Key className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Keys stay in your browser</p>
          <p className="mt-0.5 text-xs text-blue-700">
            API keys are stored in <code className="font-mono">localStorage</code> and sent directly
            to the provider's API from your browser. They are never sent to the ASVA Group Claims AI
            backend. Clear your browser data to remove them.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Quick start</h3>
        <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
          <li>Paste your OpenAI API key in the field above and click Save Key.</li>
          <li>Navigate to <strong className="text-foreground">AI Analyst</strong> or the Output Viewer sidebar.</li>
          <li>Ask questions about your claims data — the AI has context of your last validation run.</li>
        </ol>
      </div>
    </div>
  );
}
