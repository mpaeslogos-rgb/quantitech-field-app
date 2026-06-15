/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EBEBF3',
          100: '#C5C4E0',
          200: '#9592C8',
          300: '#6B68B8',
          400: '#413DA0',
          500: '#2E2A8E',
          600: '#231F7A',
          700: '#1b1464',
          800: '#130F4C',
          900: '#0C0A33',
        },
      },
    },
  },
  plugins: [],
}

