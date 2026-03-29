import { AppPageMain } from "@/components/layout/app-page";

type PlaceholderPageProps = {
  screenId: string;
  title: string;
};

export function PlaceholderPage({ screenId, title }: PlaceholderPageProps) {
  return (
    <AppPageMain>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {screenId}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h1>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-neutral-500">
        フェーズ A：ルート骨格のみ。以降のフェーズで実装します。
      </p>
    </AppPageMain>
  );
}
