import Image from "next/image";

/**
 * CDC wordmark (light variant on paper background).
 * Dark variant: `public/brand/cdc-wordmark-dark-hi.jpg` for future dark surfaces.
 */
export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Image
        src="/brand/cdc-wordmark-light-hi.jpg"
        alt=""
        width={900}
        height={600}
        className="brand-mark-image"
        priority
      />
    </div>
  );
}
