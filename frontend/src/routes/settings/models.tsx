import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";

export const Route = createFileRoute("/settings/models")({
  component: ModelsPage,
  head: () => ({ meta: [{ title: "LLM Models — McKesson Claims AI" }] }),
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
    description: "Most capable GPT model. Best for complex reasoning and analysis.",
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
  {
    id: "auto",
    name: "Auto Select",
    provider: "McKesson AI",
    description: "Automatically selects the best model based on the task complexity.",
    available: false,
    badge: "Coming Soon",
  },
];

function ModelsPage() {
  const { selectedModel, setSelectedModel } = useApp();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">LLM Models</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the language model powering AI Analyst. API keys are managed securely on the
          backend.
        </p>
      </div>

      <div className="space-y-3">
        {MODELS.map((model) => (
          <button
            key={model.id}
            disabled={!model.available}
            onClick={() => model.available && setSelectedModel(model.id)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              selectedModel === model.id
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
                    selectedModel === model.id ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground",
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
              {selectedModel === model.id && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-medium text-blue-700">
          Currently selected:{" "}
          <strong>{MODELS.find((m) => m.id === selectedModel)?.name ?? selectedModel}</strong>
        </p>
        <p className="mt-1 text-xs text-blue-600">
          The model is used by AI Analyst via the backend. Your API key is never exposed in the
          browser.
        </p>
      </div>
    </div>
  );
}
