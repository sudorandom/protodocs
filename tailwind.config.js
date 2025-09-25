/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  darkMode: 'media',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        'auto-fit-minmax': 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
      }
    },
  },
  plugins: [typography],
}
