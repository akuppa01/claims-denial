import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, HelpCircle, Mail, Play, Upload } from "lucide-react";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Help — ASVA Group Claims AI" }] }),
});

function HelpPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Help</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick guidance for using ASVA Group Claims AI.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground">Getting Started</h3>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground list-none">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">1</span>
            <div>
              <p className="font-medium text-foreground">Upload your files</p>
              <p className="text-xs mt-0.5">Go to <strong>Upload Claims</strong> and upload all 6 required Excel files including the Rules Brain.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">2</span>
            <div>
              <p className="font-medium text-foreground">Run validation</p>
              <p className="text-xs mt-0.5">Go to <strong>Validation Runs</strong> and click <em>Run Pipeline</em>. The backend processes all claims against your rules.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">3</span>
            <div>
              <p className="font-medium text-foreground">Review results</p>
              <p className="text-xs mt-0.5">Open <strong>Output Viewer</strong> to browse the table and download the Excel file. Select a run from the dropdown if you have multiple.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">4</span>
            <div>
              <p className="font-medium text-foreground">Chat with AI Analyst</p>
              <p className="text-xs mt-0.5">Add your OpenAI key in <strong>Settings → API Keys</strong>, then ask questions about your results on the <strong>AI Analyst</strong> page.</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-foreground">Common Questions</h3>
        </div>
        {[
          {
            q: "Which files are required?",
            a: "All 6 files: Denial Records, Contracts Data, Customer Master, Material Master, Pricing Data, and the Rules Brain.",
          },
          {
            q: "Why does AI Analyst say 'No API Key'?",
            a: "Add your OpenAI API key in Settings → API Keys. It's stored in your browser only.",
          },
          {
            q: "Can I run multiple validations in one session?",
            a: "Yes — each run is tracked separately. Use the dropdown in Output Viewer or AI Analyst to switch between them.",
          },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-border pb-3 last:border-0 last:pb-0 pt-3 first:pt-0">
            <p className="text-xs font-semibold text-foreground">{q}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{a}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <Mail className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Still have questions?</p>
          <p className="text-xs text-muted-foreground">
            Contact{" "}
            <a href="mailto:akuppa01@gmail.com" className="text-blue-600 underline hover:text-blue-700">
              akuppa01@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
