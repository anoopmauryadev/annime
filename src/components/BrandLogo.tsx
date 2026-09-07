/** Original AZ monogram: two angular ribbons separated by a play-shaped cut. */
export default function BrandLogo({ className = "", markOnly = false }: { className?: string; markOnly?: boolean }) {
  return (
    <span className={`az-brand ${className}`} role="img" aria-label="Hindi Anime Zone">
      <svg className="az-mark" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path className="az-mark-a" d="M8 80 37 20H55L32 80H8Z" fill="#ff640a" />
        <path className="az-mark-z" d="M60 20H94L69 57H89L80 80H43L68 43H51L60 20Z" fill="#fff4e8" />
        <path className="az-mark-play" d="M36 54 51 63 29 71Z" fill="#ffae62" />
      </svg>
      {!markOnly && <span className="az-wordmark"><span className="az-language">Hindi</span><span className="az-name">ANIME<span>ZONE</span></span></span>}
    </span>
  );
}
