/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: token('line'),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted'), subtle: token('ink-subtle') },
        accent: { DEFAULT: token('accent'), strong: token('accent-strong'), soft: token('accent-soft'), on: token('accent-on') },
        ok: { DEFAULT: token('ok'), soft: token('ok-soft') },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
        bad: { DEFAULT: token('bad'), soft: token('bad-soft') },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
      },
      fontFamily: {
        sans: ['Geist', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px', xl: '18px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .06), 0 1px 1px rgb(var(--shadow) / .04)',
        pop: '0 12px 32px -8px rgb(var(--shadow) / .22), 0 2px 6px rgb(var(--shadow) / .08)',
      },
    },
  },
  plugins: [],
};
