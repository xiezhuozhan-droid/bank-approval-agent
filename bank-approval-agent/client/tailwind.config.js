/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bank: {
          DEFAULT: '#0f4c81', // 银行深蓝
          dark: '#0a3a63',
          light: '#1a66ad',
        },
      },
    },
  },
  plugins: [],
};
