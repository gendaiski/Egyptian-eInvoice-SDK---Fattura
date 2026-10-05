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
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        gold: token('gold'),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted'), subtle: token('ink-subtle') },
        accent: { DEFAULT: token('accent'), strong: token('accent-strong'), soft: token('accent-soft'), on: token('accent-on') },
        ok: { DEFAULT: token('ok'), soft: token('ok-soft') },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
        bad: { DEFAULT: token('bad'), soft: token('bad-soft') },
        info: { DEFAULT: token('info'), soft: token('info-soft') },
      },
      fontFamily: {
        sans: ['Geist', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        display: ['Alexandria', 'Geist', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px', xl: '18px', control: 'var(--radius-control)', card: 'var(--radius-card)', sheet: 'var(--radius-sheet)' },
      fontSize: {
        'display-xl': ['clamp(38px, 4.9vw, 64px)', { lineHeight: '1.02', letterSpacing: '-0.035em', fontWeight: '600' }],
        'display': ['clamp(32px, 4.2vw, 52px)', { lineHeight: '1.06', letterSpacing: '-0.03em', fontWeight: '600' }],
        'title': ['clamp(24px, 2.6vw, 32px)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'lead': ['18px', { lineHeight: '1.6' }],
        'eyebrow': ['12px', { lineHeight: '1.2', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      transitionTimingFunction: { standard: 'cubic-bezier(.2, .7, .2, 1)' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .06), 0 1px 1px rgb(var(--shadow) / .04)',
        pop: '0 12px 32px -8px rgb(var(--shadow) / .22), 0 2px 6px rgb(var(--shadow) / .08)',
      },
    },
  },
  plugins: [],
};
