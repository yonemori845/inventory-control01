/** ログイン・アプリシェル共通のブランドマーク（レイヤー型） */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M6 10.5 16 5l10 5.5v11L16 32 6 21.5v-11Z"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <path
        d="M6 10.5 16 16l10-5.5M16 16v16"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
      />
    </svg>
  );
}
