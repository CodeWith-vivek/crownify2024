import { useRef, useState } from "react";

// Ports the original site's own magnify() function (public/js from
// footershopdetails-scripts.ejs — the classic W3Schools "image zoom" glass
// snippet) rather than a custom implementation. The original copy had the
// glass's width/height/border/position lines dropped, so the lens never had
// any size and was invisible even though the mousemove math was correct —
// same square lens, same zoom=2 cursor-tracking logic, just with those
// missing dimensions restored so it's actually visible.
export function MagnifierImage({ src, alt, zoom = 2, lensSize = 200, style, className }) {
  const imgRef = useRef(null);
  const [show, setShow] = useState(false);
  const [glass, setGlass] = useState({ left: 0, top: 0, bgX: 0, bgY: 0, bgW: 0, bgH: 0 });

  const bw = 3;
  const w = lensSize / 2;
  const h = lensSize / 2;

  const moveMagnifier = (e) => {
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (x > img.offsetWidth - w / zoom) x = img.offsetWidth - w / zoom;
    if (x < w / zoom) x = w / zoom;
    if (y > img.offsetHeight - h / zoom) y = img.offsetHeight - h / zoom;
    if (y < h / zoom) y = h / zoom;

    setGlass({
      left: x - w,
      top: y - h,
      bgX: -(x * zoom - w + bw),
      bgY: -(y * zoom - h + bw),
      bgW: img.offsetWidth * zoom,
      bgH: img.offsetHeight * zoom,
    });
  };

  return (
    <div style={{ position: "relative", ...style }} className={className}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: "inherit" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onMouseMove={moveMagnifier}
      />
      {show && (
        <div
          className="img-magnifier-glass"
          style={{
            display: "block",
            position: "absolute",
            left: glass.left,
            top: glass.top,
            width: lensSize,
            height: lensSize,
            border: `2px solid #8c8c8c`,
            borderRadius: "50%",
            cursor: "none",
            pointerEvents: "none",
            backgroundImage: `url(${src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${glass.bgW}px ${glass.bgH}px`,
            backgroundPosition: `${glass.bgX}px ${glass.bgY}px`,
          }}
        />
      )}
    </div>
  );
}
