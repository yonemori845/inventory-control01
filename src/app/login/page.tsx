import { LoginForm } from "@/components/auth/LoginForm";

type SearchParams = Promise<{
  next?: string;
  error?: string;
}>;

/** SCR-AUTH-LOGIN（デザイン設計書 §6.1） */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const nextPath =
    sp.next && sp.next.startsWith("/") ? sp.next : "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-canvas)] p-8 dark:bg-[var(--app-canvas-dark)]">
      <LoginForm nextPath={nextPath} authError={sp.error} />
    </main>
  );
}
