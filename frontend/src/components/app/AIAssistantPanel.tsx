import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, Loader2, AlertCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import type { OutputRow } from "@/context/AppContext";
import { Link } from "@tanstack/react-router";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const PROMPT_CHIPS = [
  "Summarize this validation run",
  "Which claims need human review?",
  "What are the top denial reasons?",
  "How many claims are invalid vs valid?",
  "Draft an email summary for my manager",
];

const MODEL_TO_API: Record<string, { url: string; model: string; keyStorage: string }> = {
  "gpt-4o": { url: OPENAI_API_URL, model: "gpt-4o", keyStorage: "openai_api_key" },
  "gpt-4o-mini": { url: OPENAI_API_URL, model: "gpt-4o-mini", keyStorage: "openai_api_key" },
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

function getApiKey(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function buildSystemPrompt(outputRows: OutputRow[], runLabel?: string): string {
  const total = outputRows.length;
  const valid = outputRows.filter((r) => r.validationStatus === "Valid").length;
  const invalid = outputRows.filter((r) => r.validationStatus === "Invalid").length;
  const review = outputRows.filter((r) => r.validationStatus === "Review").length;

  const topDenials = outputRows
    .filter((r) => r.denialReason && r.denialReason !== "N/A")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.denialReason] = (acc[r.denialReason] || 0) + 1;
      return acc;
    }, {});
  const topDenialStr = Object.entries(topDenials)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `  - ${reason}: ${count}`)
    .join("\n");

  const sampleRows = outputRows.slice(0, 15);
  const sampleStr = sampleRows
    .map(
      (r) =>
        `  [${r.claimId}] ${r.customer || "Unknown"} | ${r.material || "—"} | ${r.validationStatus} | ${r.denialReason} | ${r.confidence} confidence | ${r.recommendation}`,
    )
    .join("\n");

  const dataContext =
    total > 0
      ? `Current validation run${runLabel ? ` (${runLabel})` : ""} summary:
- Total claims processed: ${total}
- Valid: ${valid} (${total ? ((valid / total) * 100).toFixed(1) : 0}%)
- Invalid: ${invalid} (${total ? ((invalid / total) * 100).toFixed(1) : 0}%)
- Needs Review: ${review} (${total ? ((review / total) * 100).toFixed(1) : 0}%)

Top denial reasons:
${topDenialStr || "  No denials recorded"}

Sample claim records (first 15):
${sampleStr || "  No records available"}`
      : "No validation has been run yet. Working from sample preview data only.";

  return `You are an AI analyst for a McKesson pharmaceutical claims denial management system. Your job is to help users understand validation results, identify patterns, and suggest next steps.

${dataContext}

Guidelines:
- Be concise and professional; use plain language suitable for a revenue cycle manager
- When drafting emails, use a professional but brief tone
- Focus on actionable insights
- If asked about specific claims, refer to the data provided above
- If no actual validation has been run yet, note you are working from sample preview data`;
}

type Props = {
  outputRows?: OutputRow[];
  runLabel?: string;
};

export function AIAssistantPanel({ outputRows: propRows, runLabel }: Props) {
  const { outputRows: ctxRows, selectedModel } = useApp();
  const outputRows = propRows ?? ctxRows;

  const apiConfig = MODEL_TO_API[selectedModel] ?? MODEL_TO_API["gpt-4o-mini"];
  const apiKey = getApiKey(apiConfig.keyStorage);
  const hasKey = !!apiKey;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset chat when output data changes (different run selected)
  const rowCountRef = useRef(outputRows.length);
  useEffect(() => {
    if (outputRows.length !== rowCountRef.current) {
      rowCountRef.current = outputRows.length;
      setMessages([]);
      setError(null);
    }
  }, [outputRows.length]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const key = getApiKey(apiConfig.keyStorage);
    if (!key) {
      setError("No API key configured. Add it in Settings → API Keys.");
      return;
    }

    setError(null);
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(outputRows, runLabel);
      const payload = {
        model: apiConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 800,
        temperature: 0.4,
      };

      const res = await fetch(apiConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message ?? `API error ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "No response received.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }

  const modelLabel = apiConfig.model;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
          <Bot className="h-4 w-4 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">AI Analyst</p>
          <p className="truncate text-xs text-muted-foreground">
            {runLabel ? runLabel : "Claims intelligence assistant"}
          </p>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            hasKey ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
          )}
        >
          {hasKey ? "Connected" : "No API Key"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-indigo-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                {modelLabel}
              </div>
              <p className="mt-1 text-xs text-indigo-600">
                {outputRows.length > 0
                  ? `Loaded ${outputRows.length} claims. Ask anything about this validation run.`
                  : "Ask questions about your validation results, get summaries, or draft follow-up emails."}
                {!hasKey && (
                  <>
                    {" "}
                    <Link to="/settings/api-keys" className="underline font-medium">
                      Add your API key
                    </Link>{" "}
                    to get started.
                  </>
                )}
              </p>
            </div>
            {!hasKey && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Settings className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700">
                  Configure your API key in{" "}
                  <Link to="/settings/api-keys" className="font-medium underline">
                    Settings → API Keys
                  </Link>{" "}
                  to enable AI responses.
                </p>
              </div>
            )}
            <p className="text-xs font-medium text-muted-foreground">Try asking…</p>
            <div className="space-y-2">
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={!hasKey}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[88%] rounded-xl px-3 py-2.5 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-muted text-foreground whitespace-pre-wrap",
                )}
              >
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground max-w-[88%]">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                Thinking…
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-300 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder={hasKey ? "Ask about your claims data…" : "Add API key in Settings to chat"}
            disabled={!hasKey || isLoading}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!hasKey || isLoading || !input.trim()}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-indigo-600 disabled:opacity-40"
            aria-label="Send"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          {modelLabel} · Responses include your selected run's claims data as context
        </p>
      </div>
    </div>
  );
}
