import Link from 'next/link';
import Image from 'next/image';

type PhoneFrameProps = {
  src?: string;
  alt: string;
  label?: string;
  priority?: boolean;
  className?: string;
  tilt?: 'left' | 'right' | 'none';
};

export function PhoneFrame({
  src,
  alt,
  label,
  priority = false,
  className = '',
  tilt = 'none',
}: PhoneFrameProps) {
  const tiltClass =
    tilt === 'left' ? '-rotate-2' : tilt === 'right' ? 'rotate-2' : '';

  return (
    <div
      className={`relative mx-auto w-[min(100%,280px)] sm:w-[300px] ${tiltClass} ${className}`}
    >
      <div className="relative rounded-[2.35rem] bg-phone-bezel p-[10px] shadow-phone ring-1 ring-black/40">
        <div
          className="pointer-events-none absolute left-1/2 top-[18px] z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"
          aria-hidden
        />
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[1.85rem] bg-phone-frame">
          {src ? (
            <Image
              src={src}
              alt={alt}
              width={1080}
              height={2400}
              priority={priority}
              className="absolute inset-0 h-full w-full object-cover object-top"
              sizes="(max-width: 640px) 280px, 300px"
            />
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#1c1f2a] to-[#14161e] px-6 text-center"
              role="img"
              aria-label={alt}
            >
              <span className="font-mono-label text-[10px] uppercase tracking-[0.16em] text-white/35">
                Screenshot
              </span>
              <span className="font-display text-lg font-semibold text-white/80">
                {label ?? 'Coming soon'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
