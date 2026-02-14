/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0A1628',
          card: '#1E3A5F',
          accent: '#2563EB',
        },
        surface: {
          DEFAULT: '#111827',
          light: '#1F2937',
          sidebar: '#0F172A',
        },
        success: '#14B8A6',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
};
