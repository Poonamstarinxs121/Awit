/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#f8fafc',
          card: '#ffffff',
          accent: '#2563eb',
          'accent-hover': '#1d4ed8',
        },
        surface: {
          DEFAULT: '#ffffff',
          light: '#f1f5f9',
          sidebar: '#f8fafc',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        'text-primary': '#0f172a',
        'text-secondary': '#64748b',
        'text-muted': '#94a3b8',
        'border-default': '#e2e8f0',
        'purple-accent': '#7c3aed',
      },
      fontFamily: {
        body: ['IBM Plex Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Sora', 'IBM Plex Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
