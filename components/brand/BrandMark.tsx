import Image from "next/image";

/**
 * CDC brand mark (light variant on paper background).
 * Dark variant: `public/brand/cdc-mark-dark.jpg` for future dark surfaces.
 *
 * TODO: add wordmarks and avatars to `public/brand/` when uploaded to Drive.
 */
export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Image
        src="/brand/cdc-mark-light.jpg"
        alt=""
        width={54}
        height={36}
        className="brand-mark-image"
        priority
      />
    </div>
  );
}
