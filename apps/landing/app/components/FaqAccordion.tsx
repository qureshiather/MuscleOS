'use client';

import { useState } from 'react';

import { FAQ_ITEMS } from '../data/faq';
import { PhoneFrame } from './PhoneFrame';

function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FaqAccordion() {
  const [openId, setOpenId] = useState<string | null>(
    FAQ_ITEMS.find((item) => item.defaultOpen)?.id ?? null
  );

  return (
    <div className="divide-y divide-border/80 overflow-hidden rounded-2xl border border-border bg-surface">
      {FAQ_ITEMS.map((item) => {
        const isOpen = openId === item.id;
        return (
          <details
            key={item.id}
            id={item.id}
            className="group scroll-mt-24"
            open={isOpen}
            onToggle={(event) => {
              const nextOpen = event.currentTarget.open;
              if (nextOpen) {
                setOpenId(item.id);
              } else if (openId === item.id) {
                setOpenId(null);
              }
            }}
          >
            <summary className="faq-summary flex cursor-pointer list-none items-start gap-4 px-5 py-5 text-left outline-none transition hover:bg-background/60 focus-visible:bg-background/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:px-6 sm:py-6">
              <h3 className="font-display min-w-0 flex-1 text-base font-semibold tracking-tight text-ink sm:text-lg">
                {item.question}
              </h3>
              <Chevron className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="px-5 pb-6 sm:px-6">
              <div
                className={
                  item.screenshot
                    ? 'grid items-start gap-6 lg:grid-cols-[1fr_auto]'
                    : undefined
                }
              >
                <div className="max-w-2xl space-y-3 text-[15px] leading-relaxed text-ink-secondary">
                  {item.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  {item.steps ? (
                    <ol className="list-decimal space-y-2 pl-5">
                      {item.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                  {item.bullets ? (
                    <ul className="space-y-2">
                      {item.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2.5">
                          <span
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.aside ? (
                    <p className="border-t border-border/70 pt-3 text-sm text-ink-muted">
                      {item.aside}
                    </p>
                  ) : null}
                </div>
                {item.screenshot ? (
                  <div className="flex justify-center lg:justify-end">
                    <PhoneFrame
                      src={item.screenshot.src}
                      alt={item.screenshot.alt}
                      label={item.screenshot.label}
                      size="compact"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
