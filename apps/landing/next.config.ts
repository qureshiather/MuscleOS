import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Soft crossfade between routes (Home ↔ Privacy ↔ Terms)
    viewTransition: true,
  },
};

export default config;
