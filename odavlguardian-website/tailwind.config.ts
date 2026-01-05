import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: {
          black: '#0A0A0A',
          'dark-1': '#121212',
          'dark-2': '#1A1A1A',
          'dark-3': '#252525',
        },
        brown: {
          'dark': '#1C1410',
          'medium': '#2A1F1A',
          'shadow': '#3A2A22',
          'border': '#3D3028',
        },
        signal: {
          orange: '#F59E0B',
          'orange-deep': '#D97706',
          'orange-glow': 'rgba(245, 158, 11, 0.15)',
        },
        text: {
          primary: '#FAFAFA',
          secondary: '#D4CDC5',
          muted: '#9B8F84',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
      },
      animation: {
        'blob': 'blob 30s infinite',
        'fade-up': 'fade-up 0.8s ease-out',
      },
      keyframes: {
        blob: {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -40px) scale(1.05)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.95)',
          },
          '100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
        },
        'fade-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(16px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
