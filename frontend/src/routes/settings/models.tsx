import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, CheckCircle2, Save, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings/models")({
  component: ModelsPage,
  head: () => ({ meta: [{ title: "LLM Models — ASVA Group Claims AI" }] }),
});

type ModelOption = {
  id: string;
  name: string;
  provider: string;
  description: string;
  available: boolean;
  badge?: string;
};

const MODELS: ModelOption[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Most capable GPT model. Best for complex reasoning and deep analysis.",
    available: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o mini",
    provider: "OpenAI",
    description: "Faster and more economical. Good for routine validation summaries.",
    available: true,
    badge: "Recommended",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    provider: "Anthropic",
    description: "Balanced performance and speed. Excellent for document analysis.",
    available: false,
    badge: "Coming Soon",
  },
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "Google",
    description: "Google's flagship model with strong reasoning capabilities.",
    available: false,
    badge: "Coming Soon",
  },
];

function ModelsPage() {
  const { selectedModel, setSelectedModel } = useApp();
  const [pending, setPending] = useState(selectedModel);
  const [justSaved, setJustSaved] = useState(false);

  const isDirty = pending !== selectedModel;

  function handleSave() {
    setSelectedModel(pending);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">LLM Models</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the language model powering the AI Analyst. Both models use your OpenAI API key.
        </p>
      </div>

      <div className="space-y-3">
        {MODELS.map((model) => (
          <button
            key={model.id}
            disabled={!model.available}
            onClick={() => model.available && setPending(model.id)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              pending === model.id
                ? "border-blue-500 bg-blue-50 shadow-sm"
                : model.available
                  ? "border-border bg-white hover:border-blue-300 hover:bg-blue-50/30"
                  : "cursor-not-allowed border-border bg-muted/30 opacity-60",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    pending === model.id ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{model.name}</p>
                    <span className="text-xs text-muted-foreground">· {model.provider}</span>
                    {model.badge && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          model.badge === "Recommended"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{model.description}</p>
                </div>
              </div>
              {pending === model.id && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-foreground">
            {isDirty
              ? `Switching to ${MODELS.find((m) => m.id === pending)?.name ?? pending}`
              : `Active: ${MODELS.find((m) => m.id === selectedModel)?.name ?? selectedModel}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isDirty
              ? "Click Save to apply this model to the AI Analyst."
              : "Model is saved and active for the AI Analyst."}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty && !justSaved}
          className="gap-1.5 h-9 text-xs min-w-[90px]"
        >
          {justSaved ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-medium text-blue-700">How model selection works</p>
        <p className="mt-1 text-xs text-blue-600">
          Both GPT-4o and GPT-4o mini use your OpenAI API key stored in the browser. The AI Analyst
          calls the OpenAI API directly from your browser — your key is never sent to the ASVA Group
          Claims AI backend.
        </p>
      </div>
    </div>
  );
}
