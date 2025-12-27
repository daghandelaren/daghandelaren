import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CoinMarketCap-inspired dark theme colors
        background: {
          primary: '#0d1421',
          secondary: '#17202f',
          tertiary: '#1e293b',
        },
        surface: {
          primary: '#1a2332',
          secondary: '#222d3d',
          hover: '#2a3a4d',
        },
        text: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
        accent: {
          blue: '#3861fb',
          cyan: '#22d3ee',
        },
        sentiment: {
          bullish: '#16c784',
          bearish: '#ea3943',
          neutral: '#f59e0b',
        },
        border: {
          primary: '#2d3748',
          secondary: '#374151',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
