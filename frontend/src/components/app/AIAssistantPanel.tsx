import { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PROMPT_CHIPS = [
  "Summarize this validation run",
  "Which claims need human review?",
  "What are the top denial reasons?",
  "Explain why this claim was marked invalid",
  "Draft an email summary for my manager",
];

type Message = {
  role: "user" | "assistant";
  content: string;
};

const COMING_SOON_REPLY =
  "AI Analyst is coming soon. This feature will connect to your selected LLM through the backend so your API key stays secure. Stay tuned!";

export function AIAssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  function sendMessage(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: COMING_SOON_REPLY },
    ]);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
          <Bot className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">AI Analyst</p>
          <p className="text-xs text-muted-foreground">Claims intelligence assistant</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          Coming Soon
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-indigo-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-700">
                <Sparkles className="h-3.5 w-3.5" />
                Preview Mode
              </div>
              <p className="mt-1 text-xs text-indigo-600">
                Chat with your claims data, summarize validation results, and investigate
                exceptions. Connect your OpenAI key in Settings to get started.
              </p>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Suggested prompts</p>
            <div className="space-y-2">
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
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
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                  msg.role === "user"
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-muted text-foreground",
                )}
              >
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about your claims data…"
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => sendMessage(input)}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-blue-600"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          AI features require backend configuration
        </p>
      </div>
    </div>
  );
}
