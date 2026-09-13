import { ChallengeDashboard } from "@/components/challenge-dashboard";
import { GoogleFitConnectionCard } from "@/components/google-fit-connection-card";
import { getBaseUrl, getGoogleRedirectUri } from "@/lib/google-fit-auth";

export default async function Home() {
  const appUrl = await getBaseUrl();
  const redirectUri = await getGoogleRedirectUri();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_42%,#eef2ff_100%)] px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <ChallengeDashboard />
        <GoogleFitConnectionCard appUrl={appUrl} redirectUri={redirectUri} />
      </div>
    </main>
  );
}
