import Image from 'next/image';

type PhoneFrameProps = {
  src?: string;
  alt: string;
  label?: string;
  priority?: boolean;
  className?: string;
  size?: 'default' | 'compact';
};

const SIZE_CLASS = {
  default: 'w-[200px] sm:w-[240px] lg:w-[280px]',
  compact: 'w-[148px] sm:w-[168px] lg:w-[184px]',
} as const;

export function PhoneFrame({
  src,
  alt,
  label,
  priority = false,
  className = '',
  size = 'default',
}: PhoneFrameProps) {
  return (
    <div className={`relative mx-auto ${SIZE_CLASS[size]} ${className}`}>
      <div
        className={`relative rounded-[2.2rem] bg-phone-bezel p-2.5 ring-1 ring-black/40 ${
          size === 'compact' ? 'shadow-phone-sm' : 'shadow-phone'
        }`}
      >
        <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[1.7rem] bg-phone-frame">
          {src ? (
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              className="object-cover object-top"
              sizes={
                size === 'compact'
                  ? '(max-width: 640px) 148px, (max-width: 1024px) 168px, 184px'
                  : '(max-width: 640px) 200px, (max-width: 1024px) 240px, 280px'
              }
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
