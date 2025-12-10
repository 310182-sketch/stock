import forms from '@tailwindcss/forms'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bull: {
          DEFAULT: '#00C853',
          light: '#69F0AE',
          dark: '#00A844',
        },
        bear: {
          DEFAULT: '#FF1744',
          light: '#FF5252',
          dark: '#D50000',
        },
        neutral: {
          DEFAULT: '#9E9E9E',
          light: '#EEEEEE',
          dark: '#424242',
        },
        bg: {
          primary: '#0A0E27',
          secondary: '#141A3A',
          card: '#1E2749',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      animation: {
        ticker: 'ticker 30s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [forms],
}

