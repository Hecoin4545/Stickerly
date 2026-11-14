export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#E84393',
          dark: '#1A1A1A',
          cream: '#F8F7F4',
          green: '#22C55E',
          amber: '#F59E0B',
          blue: '#3B82F6',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
