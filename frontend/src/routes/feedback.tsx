import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/feedback")({
  component: FeedbackPage,
  head: () => ({ meta: [{ title: "Feedback — McKesson Claims AI" }] }),
});

function FeedbackPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground">Feedback</h2>
      <PlaceholderPage
        icon={<MessageSquare className="h-8 w-8" />}
        title="Send Feedback"
        description="Share your thoughts, report bugs, or request features directly from the app."
        badge="Coming Soon"
      />
    </div>
  );
}
