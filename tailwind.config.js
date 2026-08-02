// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        andromeda: {
          50: '#f5efff',
          100: '#e7dbff',
          200: '#c9b3ff',
          300: '#a782ff',
          400: '#7f49ff',
          500: '#5c1eff',
          600: '#4b18db',
          700: '#3b1299',
          800: '#2a0c66',
          900: '#190533',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
