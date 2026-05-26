import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#050505',
        'bg-soft': '#080808',
        panel: '#0A0A0A',
        'panel-2': '#0D0D0E',
        accent: '#5BFFB0',
        'accent-2': '#98FFD1',
        'accent-dim': '#1B2C24',
        text: '#E9EEF5',
        'text-2': '#B7BFCC',
        muted: '#6B7280',
        'muted-2': '#3F4654',
        'red-arb': '#FF6B6B',
        'red-dim': '#8E3F3F',
        yellow: '#F5D061',
      },
      fontFamily: {
        sans: ['Switzer', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
