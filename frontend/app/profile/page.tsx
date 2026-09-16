import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { onboarding } = await searchParams;
  return (
    <AppShell>
      <ProfileForm onboarding={onboarding === "1"} />
    </AppShell>
  );
}
