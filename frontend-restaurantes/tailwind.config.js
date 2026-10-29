/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Inter"', '-apple-system', '"SF Pro Display"', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'monospace'],
      },
      colors: {
        apple: {
          bg: '#FFFFFF',
          'bg-secondary': '#F5F5F7',
          'bg-tertiary': '#FAFAFA',
          text: '#1D1D1F',
          'text-secondary': '#86868B',
          'text-tertiary': '#AEAEB2',
          blue: '#0071E3',
          'blue-hover': '#0077ED',
          'blue-light': '#E8F4FD',
          accent: '#FF6B35',
          'accent-hover': '#FF5722',
          border: '#D2D2D7',
          'border-light': '#E8E8ED',
          glass: 'rgba(255,255,255,0.72)',
          'glass-border': 'rgba(255,255,255,0.3)',
        },
        'apple-dark': {
          bg: '#000000',
          'bg-secondary': '#1D1D1F',
          'bg-tertiary': '#2D2D2F',
          text: '#F5F5F7',
          'text-secondary': '#A1A1A6',
          'text-tertiary': '#6E6E73',
          blue: '#2997FF',
          'blue-hover': '#40A9FF',
          'blue-light': '#1A2A3A',
          accent: '#FF6B35',
          'accent-hover': '#FF7F50',
          border: '#424245',
          'border-light': '#333336',
          glass: 'rgba(0,0,0,0.72)',
          'glass-border': 'rgba(255,255,255,0.08)',
        },
      },
      fontSize: {
        'apple-hero': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '700' }],
        'apple-headline': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        'apple-title': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '600' }],
        'apple-body': ['1.0625rem', { lineHeight: '1.55', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        'apple': '1.25rem',
        'apple-lg': '1.75rem',
        'apple-xl': '2.25rem',
        'apple-full': '9999px',
      },
      boxShadow: {
        'apple-sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        'apple': '0 4px 16px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
        'apple-md': '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        'apple-lg': '0 12px 48px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        'apple-xl': '0 20px 60px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.06)',
        'apple-glow': '0 0 40px rgba(0,113,227,0.15)',
        'apple-glow-orange': '0 0 40px rgba(255,107,53,0.15)',
      },
      backdropBlur: {
        'apple': '20px',
        'apple-heavy': '40px',
      },
      transitionDuration: {
        '250': '250ms',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 6s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'float-slow': 'float 8s cubic-bezier(0.45, 0, 0.55, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
}