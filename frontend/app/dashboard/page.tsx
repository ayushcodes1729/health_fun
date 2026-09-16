import { AppShell } from "@/components/app-shell";
import { HistoryView } from "@/components/history-view";

export default function DashboardPage() {
  return (
    <AppShell>
      <HistoryView />
    </AppShell>
  );
}
