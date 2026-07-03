/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#080810',
        'bg-2':         '#0e0e1a',
        surface:        '#13131f',
        'surface-2':    '#1a1a2e',
        border:         '#1f1f35',
        'border-bright':'#2a2a45',
        accent:         '#00c8ff',
        'accent-2':     '#7b5ea7',
        text:           '#e2e4f0',
        'text-muted':   '#6b6d85',
        'text-dim':     '#3a3c55',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
