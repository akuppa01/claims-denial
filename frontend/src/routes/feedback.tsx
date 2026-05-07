import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
  head: () => ({ meta: [{ title: "Feedback — McKesson Claims AI" }] }),
});

function FeedbackPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Feedback</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share your thoughts, report bugs, or request features.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-foreground">Ways to Give Feedback</h3>
        </div>
        {[
          { label: "Bug report", desc: "Something isn't working correctly" },
          { label: "Feature request", desc: "An idea or improvement you'd like to see" },
          { label: "General feedback", desc: "Thoughts on the overall experience" },
          { label: "Data or output questions", desc: "Questions about specific validation results" },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-white p-4 shadow-sm flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <Mail className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Send feedback directly</p>
          <p className="text-xs text-muted-foreground">
            Email{" "}
            <a href="mailto:akuppa01@gmail.com" className="text-blue-600 underline hover:text-blue-700">
              akuppa01@gmail.com
            </a>{" "}
            and we'll get back to you.
          </p>
        </div>
      </div>
    </div>
  );
}
