/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FAF7F2',
          card: '#FFFFFF',
          accent: '#C4943D',
          'accent-hover': '#A87C2E',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          light: '#F5F0E8',
          sidebar: '#FAF7F2',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        'text-primary': '#1A1A1A',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
        'border-default': '#E5E1D8',
        'purple-accent': '#7C3AED',
      },
    },
  },
  plugins: [],
};
