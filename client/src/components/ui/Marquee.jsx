// Continuous auto-scrolling ticker, like an endless train of cars — the item
// list is repeated enough times to comfortably overflow any viewport width,
// then animated with CSS `translateX` by exactly one repeat's width so the
// loop point is seamless and the motion never visibly resets or gaps.
export function Marquee({ items, renderItem, itemKey, speedSeconds = 20, copies = 8, className }) {
  if (items.length === 0) return null;

  const shiftPercent = 100 / copies;

  return (
    <div className={className} style={{ overflow: "hidden" }}>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-${shiftPercent}%); }
        }
        .marquee-track {
          animation: marquee-scroll ${speedSeconds}s linear infinite;
        }
      `}</style>
      <div className="marquee-track" style={{ display: "flex", width: "max-content" }}>
        {Array.from({ length: copies }).flatMap((_, c) =>
          items.map((item, i) => (
            <div key={`${itemKey(item)}-${c}-${i}`} style={{ flex: "0 0 auto" }}>
              {renderItem(item, i)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
