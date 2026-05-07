import { createFileRoute } from "@tanstack/react-router";
import { HelpCircle } from "lucide-react";
import { PlaceholderPage } from "@/components/app/PlaceholderPage";

export const Route = createFileRoute("/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Help — McKesson Claims AI" }] }),
});

function HelpPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-foreground">Help</h2>
      <PlaceholderPage
        icon={<HelpCircle className="h-8 w-8" />}
        title="Help & Documentation"
        description="User guides, video walkthroughs, and API documentation will be available here."
        badge="Coming Soon"
      />
    </div>
  );
}
