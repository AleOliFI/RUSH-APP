/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rush: {
          red:    '#e72329',
          orange: '#ff3b00',
          lime:   '#ccff00',
        },
        bg: {
          primary:   '#0f0f0f',
          secondary: '#1a1a1a',
          card:      '#1a1a1a',
          border:    '#2e2e2e',
        },
        text: {
          primary:   '#f7f5f3',
          secondary: '#9e9b94',
          muted:     '#3a3a3a',
        },
      },
      fontFamily: {
        display: ['BigShouldersDisplay_900Black', 'Impact', 'sans-serif'],
        sans:    ['Manrope_500Medium', 'system-ui', 'sans-serif'],
        mono:    ['JetBrainsMono', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.14em',
      },
    },
  },
  plugins: [],
};
