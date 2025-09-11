/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        'geist': ['Geist-Regular'],
        'geist-medium': ['Geist-Medium'],
        'geist-semibold': ['Geist-SemiBold'],
        'geist-bold': ['Geist-Bold'],
        'geist-mono': ['GeistMono-Regular'],
        'geist-mono-medium': ['GeistMono-Medium'],
      },
    },
  },
  plugins: [],
}