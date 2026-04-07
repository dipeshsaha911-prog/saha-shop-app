/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        wine: {
          50:  '#fdf2f4',
          100: '#fce7eb',
          200: '#f9d0d8',
          300: '#f5a9b8',
          400: '#ee7591',
          500: '#e44870',
          600: '#cf2754',
          700: '#7B2D42',
          800: '#6b2438',
          900: '#5c1f30',
        }
      }
    },
  },
  plugins: [],
}
