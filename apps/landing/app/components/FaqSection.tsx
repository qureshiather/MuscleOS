import { PhoneFrame } from './PhoneFrame';
import { FaqAccordion } from './FaqAccordion';

const FLOW_SHOTS = [
  {
    src: '/screens/workouts.png',
    alt: 'MuscleOS Workouts tab — start empty or from a template',
    label: 'Workouts',
    caption: 'Start a workout',
  },
  {
    src: '/screens/recovery.png',
    alt: 'MuscleOS Recovery tab — muscles you trained',
    label: 'Recovery',
    caption: 'Check recovery',
  },
  {
    src: '/screens/exercises.png',
    alt: 'MuscleOS exercise library',
    label: 'Exercises',
    caption: 'Find exercises',
  },
  {
    src: '/screens/history.png',
    alt: 'MuscleOS History tab — past sessions',
    label: 'History',
    caption: 'View past workouts',
  },
] as const;

type FaqSectionProps = {
  heading?: 'h1' | 'h2';
  bordered?: boolean;
};

export function FaqSection({ heading = 'h2', bordered = true }: FaqSectionProps) {
  const Title = heading;

  return (
    <section
      id="faq"
      className={`relative scroll-mt-24 ${bordered ? 'border-t border-border/70' : ''}`}
    >
      <div className="mx-auto max-w-site px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <div className="max-w-2xl">
          <p className="font-mono-label text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            FAQ
          </p>
          <Title className="font-display mt-3 text-3xl font-bold tracking-tight text-ink text-balance sm:text-4xl">
            How to use MuscleOS
          </Title>
          <p className="mt-4 text-lg text-ink-secondary">
            Simple instructions for the main parts of the app.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:mt-12 lg:grid-cols-4 lg:gap-6">
          {FLOW_SHOTS.map((shot) => (
            <li key={shot.src}>
              <PhoneFrame src={shot.src} alt={shot.alt} label={shot.label} size="compact" />
              <p className="mt-3 px-1 text-center text-[13px] leading-snug text-ink-secondary sm:text-sm">
                {shot.caption}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-12 sm:mt-16">
          <FaqAccordion />
        </div>
      </div>
    </section>
  );
}
