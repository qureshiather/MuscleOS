import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        'background-deep': 'var(--color-background-deep)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        'ink-secondary': 'var(--color-ink-secondary)',
        'ink-muted': 'var(--color-ink-muted)',
        primary: 'var(--color-primary)',
        'primary-dim': 'var(--color-primary-dim)',
        accent: 'var(--color-accent)',
        ready: 'var(--color-ready)',
        border: 'var(--color-border)',
        'phone-frame': 'var(--color-phone-frame)',
        'phone-bezel': 'var(--color-phone-bezel)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        site: '1120px',
      },
      boxShadow: {
        phone: '0 28px 60px -20px rgba(12, 12, 20, 0.45), 0 12px 24px -16px rgba(12, 12, 20, 0.3)',
        'phone-sm': '0 18px 40px -18px rgba(12, 12, 20, 0.4)',
      },
    },
  },
  plugins: [],
} satisfies Config;
