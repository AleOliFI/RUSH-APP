/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#22C55E',
          yellow: '#EAB308',
          orange: '#F97316',
          red: '#EF4444',
          'dark-red': '#991B1B',
        },
        bg: {
          primary: '#0A0A0A',
          secondary: '#141414',
          card: '#1C1C1C',
          border: '#2A2A2A',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#A3A3A3',
          muted: '#525252',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui'],
        mono: ['JetBrainsMono', 'monospace'],
      },
    },
  },
  plugins: [],
};
