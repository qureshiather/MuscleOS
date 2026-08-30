import Image from 'next/image';

type PhoneFrameProps = {
  src?: string;
  alt: string;
  label?: string;
  priority?: boolean;
  className?: string;
};

export function PhoneFrame({
  src,
  alt,
  label,
  priority = false,
  className = '',
}: PhoneFrameProps) {
  return (
    <div className={`relative mx-auto w-[200px] sm:w-[240px] lg:w-[280px] ${className}`}>
      <div className="relative rounded-[2.2rem] bg-phone-bezel p-2.5 shadow-phone ring-1 ring-black/40">
        <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[1.7rem] bg-phone-frame">
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              className="object-cover object-top"
              sizes="(max-width: 640px) 200px, (max-width: 1024px) 240px, 280px"
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
