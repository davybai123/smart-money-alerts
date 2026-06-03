import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0A0F1E',
        surface: '#111827',
        border:  '#1F2937',
        muted:   '#6B7280',
        ev: {
          positive:    '#10B981',
          negative:    '#EF4444',
          marginal:    '#F59E0B',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-surface': 'linear-gradient(135deg, #111827 0%, #0D1425 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
