/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obs: {
          bg: '#05070d',
          panel: '#0b1020',
          surface: '#111834',
          border: '#1e2a4a',
          muted: '#6b7890',
          text: '#e6ecf5',
          dim: '#9aa7bf',
          cyan: '#22d3ee',
          blue: '#3b82f6',
          electric: '#2563eb',
          glow: 'rgba(59,130,246,0.35)',
        },
        light: {
          bg: '#f5f7fb',
          panel: '#ffffff',
          surface: '#f0f3fa',
          border: '#d9dfec',
          muted: '#6b7890',
          text: '#0b1020',
          dim: '#4b5870',
          cyan: '#0891b2',
          blue: '#2563eb',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(59,130,246,0.4)',
        'glow-sm': '0 0 12px rgba(59,130,246,0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg,#22d3ee 0%,#3b82f6 50%,#1d4ed8 100%)',
        'dark-radial': 'radial-gradient(ellipse at top, #1e3a8a33, transparent 60%)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 16px rgba(59,130,246,0.4)' }, '50%': { boxShadow: '0 0 32px rgba(59,130,246,0.7)' } },
      },
    },
  },
  plugins: [],
};
