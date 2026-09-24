/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Design tokens — see docs/design-system.md. Neutrals use Tailwind's warm
      // `stone` scale so they sit on the brand's warm off-white canvas.
      colors: {
        canvas: '#F8F6F2',
        brand: {
          50: '#EAFAF4',
          100: '#CDF3E5',
          200: '#9CE6CC',
          300: '#62D6B0',
          400: '#33CCA0',
          500: '#1BC697',
          600: '#13A67E',
          700: '#0E8565',
          800: '#0D6A52',
          900: '#0B5744',
        },
        sky: { brand: '#1EAEDB' },
        violet: { brand: '#8B5CF6' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.05)',
        pop: '0 12px 32px -8px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.06)',
        overlay: '0 24px 64px -16px rgba(28, 25, 23, 0.35)',
      },
      keyframes: {
        'drawer-in': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'dialog-in': {
          from: { transform: 'translateY(8px) scale(0.98)', opacity: '0' },
          to: { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'drawer-in': 'drawer-in 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'dialog-in': 'dialog-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
}
