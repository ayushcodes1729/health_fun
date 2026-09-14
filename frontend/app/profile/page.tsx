import { Nav } from "@/components/nav";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { onboarding } = await searchParams;
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f2fe_0%,#f8fafc_42%,#eef2ff_100%)] px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <Nav />
        <ProfileForm onboarding={onboarding === "1"} />
      </div>
    </main>
  );
}
