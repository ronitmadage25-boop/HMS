export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A1B3D',
        brand: { 50: '#EEF4FF', 100: '#DCE8FF', 200: '#B9D1FF', 300: '#8CB3FF', 400: '#5A8DF7', 500: '#2F6BEB', 600: '#1D54D4', 700: '#1742AB', 800: '#143585', 900: '#0A1B3D' },
        line: '#E1E8F5',
        mist: '#F6F9FF',
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], display: ['Sora', '"Plus Jakarta Sans"', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgba(10,27,61,.04), 0 6px 20px -8px rgba(29,84,212,.12)', lift: '0 12px 40px -12px rgba(10,27,61,.25)' },
    },
  },
  plugins: [],
};
