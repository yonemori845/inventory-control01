import { AppMainColumn } from "@/components/layout/AppMainColumn";
import { AppShell } from "@/components/layout/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShell userEmail={user?.email ?? null}>
      <AppMainColumn>{children}</AppMainColumn>
    </AppShell>
  );
}
