import { createFileRoute } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { AIAssistantPanel } from "@/components/app/AIAssistantPanel";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/ai-analyst")({
  component: AIAnalystPage,
  head: () => ({ meta: [{ title: "AI Analyst — McKesson Claims AI" }] }),
});

function AIAnalystPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">AI Analyst</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with your claims data, summarize validation results, and investigate exceptions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PlaceholderPage
            icon={<Bot className="h-8 w-8" />}
            title="AI-Powered Claims Intelligence"
            description="The AI Analyst connects to your selected LLM through the backend — your API key never touches the browser. Configure your model in Settings to get started."
            badge="Preview Mode"
          >
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              When enabled, AI Analyst will support: summarization, anomaly detection, draft email
              responses, and natural-language querying of your claims data.
            </div>
          </PlaceholderPage>
        </div>
        <div className="lg:col-span-1">
          <div className="h-[600px]">
            <AIAssistantPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
