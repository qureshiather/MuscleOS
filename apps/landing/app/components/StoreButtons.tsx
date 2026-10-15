import Image from 'next/image';

/**
 * Official App Store and Google Play badges. Google's PNG carries its own clear space
 * (41px of 250px on every side); it's drawn larger and that transparent margin clipped to match
 * Apple's badge at the same visible height.
 */
const BADGE_HEIGHT = 48;
const PLAY_SCALE = 250 / 168;
const PLAY_INSET = Math.round((BADGE_HEIGHT * 41) / 168);

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
        className="block overflow-hidden rounded-[9px] transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{ width: Math.round((BADGE_HEIGHT * 564) / 168), height: BADGE_HEIGHT }}
      >
        <Image
          src="/badges/google-play.png"
          alt="Get it on Google Play"
          width={Math.round((BADGE_HEIGHT * PLAY_SCALE * 646) / 250)}
          height={Math.round(BADGE_HEIGHT * PLAY_SCALE)}
          style={{ margin: -PLAY_INSET, maxWidth: 'none' }}
          unoptimized
        />
      </a>
    </div>
  );
}
