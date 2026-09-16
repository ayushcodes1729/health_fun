import { AppShell } from "@/components/app-shell";
import { ChallengeDashboard } from "@/components/challenge-dashboard";
import { GoogleFitConnectionCard } from "@/components/google-fit-connection-card";
import { getBaseUrl, getGoogleRedirectUri } from "@/lib/google-fit-auth";

export default async function ChallengePage() {
  const appUrl = await getBaseUrl();
  const redirectUri = await getGoogleRedirectUri();

  return (
    <AppShell>
      <ChallengeDashboard />
      <GoogleFitConnectionCard appUrl={appUrl} redirectUri={redirectUri} />
    </AppShell>
  );
}
