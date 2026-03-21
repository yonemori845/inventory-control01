type PlaceholderPageProps = {
  screenId: string;
  title: string;
};

export function PlaceholderPage({ screenId, title }: PlaceholderPageProps) {
  return (
    <main className="p-6">
      <p className="text-xs font-mono text-neutral-500">{screenId}</p>
      <h1 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        フェーズ A：ルート骨格のみ。以降のフェーズで実装します。
      </p>
    </main>
  );
}
