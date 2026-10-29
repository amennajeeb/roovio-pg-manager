/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F7F5',
          100: '#DCECE7',
          200: '#BCDDD4',
          300: '#95C8BC',
          400: '#5BA998',
          500: '#2E806E',
          600: '#1F5C4E', // Forest Green primary accent
          700: '#194A3F',
          800: '#133931',
          900: '#0E2923',
        },
        surface: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
        },
        slate: {
          main: '#0F172A',
          secondary: '#475569',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
