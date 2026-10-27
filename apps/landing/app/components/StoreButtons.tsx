import Image from 'next/image';

/**
 * Official App Store and Google Play badges. Google's PNG (646×250) holds a 564×168 badge with 41px
 * of clear space on every side. It's drawn so the badge is a little taller than Apple's, then
 * clipped evenly on all four sides to Apple's height, which trims Google's thin grey edge too. A
 * border in Apple's colour and corner radius is drawn on top so both badges share the same edge.
 */
const BADGE_HEIGHT = 48;
const BADGE_RADIUS = 8;
const PLAY_TRIM = 2;
const PLAY_PX = (BADGE_HEIGHT + 2 * PLAY_TRIM) / 168;

export function StoreButtons() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href="https://apps.apple.com/app/id6810909876"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-[9px] transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Image
          src="/badges/app-store.svg"
          alt="Download on the App Store"
          width={Math.round((BADGE_HEIGHT * 119.66407) / 40)}
          height={BADGE_HEIGHT}
          unoptimized
        />
      </a>
      <a
        href="https://play.google.com/store/apps/details?id=app.muscleos"
        target="_blank"
        rel="noopener noreferrer"
        className="relative block overflow-hidden bg-black transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{ width: 564 * PLAY_PX - 2 * PLAY_TRIM, height: BADGE_HEIGHT, borderRadius: BADGE_RADIUS }}
      >
        <Image
          src="/badges/google-play.png"
          alt="Get it on Google Play"
          width={646 * PLAY_PX}
          height={250 * PLAY_PX}
          style={{ margin: -(41 * PLAY_PX + PLAY_TRIM), maxWidth: 'none' }}
          unoptimized
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 border border-[#a6a6a6]"
          style={{ borderRadius: BADGE_RADIUS }}
        />
      </a>
    </div>
  );
}
