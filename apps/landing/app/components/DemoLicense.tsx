import { DEMO_LICENSE } from '../data/exercises';

/** The free-to-reuse note shown with the demos. */
export function DemoLicense({ className = '' }: { className?: string }) {
  return (
    <p className={`text-sm text-ink-secondary ${className}`}>
      Our exercise animations are free to reuse. They&apos;re released under{' '}
      <a href={DEMO_LICENSE.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
        {DEMO_LICENSE.name}
      </a>
      : use them in your app, site, class or coaching, with or without changes, and no credit needed.
    </p>
  );
}
