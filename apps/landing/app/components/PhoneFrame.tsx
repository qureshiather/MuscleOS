import Image from 'next/image';

type PhoneFrameProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  /** Slight tilt for depth in compositions */
  tilt?: 'left' | 'right' | 'none';
};

export function PhoneFrame({
  src,
  alt,
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
        {/* Dynamic Island */}
        <div
          className="pointer-events-none absolute left-1/2 top-[18px] z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"
          aria-hidden
        />
        <div className="overflow-hidden rounded-[1.85rem] bg-phone-frame">
          <Image
            src={src}
            alt={alt}
            width={1080}
            height={2400}
            priority={priority}
            className="block h-auto w-full"
            sizes="(max-width: 640px) 280px, 300px"
          />
        </div>
      </div>
    </div>
  );
}
