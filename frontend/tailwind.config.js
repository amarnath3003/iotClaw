/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        claw: {
          50: '#f4f8f2',
          100: '#dbead3',
          200: '#b9d3ab',
          300: '#8db57d',
          400: '#5f954f',
          500: '#3f7733',
          600: '#2f5a26',
          700: '#24451d',
          800: '#1d3618',
          900: '#172b13',
        },
      },
      animation: {
        rise: 'rise 300ms ease-out',
      },
      keyframes: {
        rise: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
