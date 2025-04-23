/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [
    function({ addBase, theme }) {
      addBase({
        'input, select, textarea': {
          border: '1px solid #e2e8f0',
          borderRadius: theme('borderRadius.md'),
          padding: theme('spacing.2'),
          '&:focus': {
            outline: 'none',
            ring: '2px',
            ringColor: theme('colors.blue.500'),
            borderColor: theme('colors.blue.500'),
          },
        },
      });
    },
  ],
};