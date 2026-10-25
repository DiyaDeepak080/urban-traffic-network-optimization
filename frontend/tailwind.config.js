/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#05080c',
          900: '#0a0f16',
          850: '#0d131c',
          800: '#111927',
          700: '#1a2436',
          600: '#263349',
        },
        accent: {
          DEFAULT: '#22d3c7',
          dim: '#1a9e96',
          bright: '#5eead4',
        },
        border: {
          DEFAULT: '#1f2937',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
