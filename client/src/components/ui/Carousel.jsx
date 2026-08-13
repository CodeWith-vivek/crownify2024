import { useEffect, useRef, useState } from "react";

// Lightweight re-implementation of the original theme's Slick carousels
// (.productSlider, .logo-bar) — horizontal sideways paging with arrows,
// infinite wraparound, and the same responsive items-per-view breakpoints
// Slick was configured with (see public/assets/js/main.js). No jQuery/Slick
// dependency, since those don't play well with React-mounted DOM.
export function Carousel({ items, renderItem, itemKey, base, breakpoints, className }) {
  const [perView, setPerView] = useState(base);
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const sorted = [...breakpoints].sort((a, b) => a.maxWidth - b.maxWidth);
      for (const bp of sorted) {
        if (w <= bp.maxWidth) return bp.count;
      }
      return base;
    };
    const onResize = () => setPerView(compute());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [base, breakpoints]);

  useEffect(() => {
    setIndex(0);
  }, [perView]);

  const maxIndex = Math.max(0, items.length - perView);
  // When there are fewer items than the desktop slot count, size items
  // against the real count so they fill the row edge-to-edge instead of
  // leaving dead space on the right (left-aligned flex default).
  const effectivePerView = Math.min(perView, items.length);
  const slideWidth = 100 / effectivePerView;

  const goTo = (i) => {
    if (i < 0) setIndex(maxIndex);
    else if (i > maxIndex) setIndex(0);
    else setIndex(i);
  };

  if (items.length === 0) return null;

  return (
    <div className={className} style={{ position: "relative" }}>
      <div style={{ overflow: "hidden" }}>
        <div
          ref={trackRef}
          style={{
            display: "flex",
            transition: "transform 400ms ease",
            transform: `translateX(-${slideWidth * index}%)`,
          }}
        >
          {items.map((item, i) => (
            <div key={itemKey(item)} style={{ flex: `0 0 ${slideWidth}%`, maxWidth: `${slideWidth}%`, boxSizing: "border-box", padding: "0 10px" }}>
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
      {items.length > perView && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => goTo(index - 1)}
            className="slick-prev slick-arrow"
            style={{ display: "block", position: "absolute", top: "50%", left: -20, transform: "translateY(-50%)", zIndex: 10, background: "#fff", border: "1px solid #eee", borderRadius: "50%", width: 34, height: 34, cursor: "pointer" }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => goTo(index + 1)}
            className="slick-next slick-arrow"
            style={{ display: "block", position: "absolute", top: "50%", right: -20, transform: "translateY(-50%)", zIndex: 10, background: "#fff", border: "1px solid #eee", borderRadius: "50%", width: 34, height: 34, cursor: "pointer" }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
