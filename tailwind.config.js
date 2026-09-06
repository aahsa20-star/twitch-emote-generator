/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    fontFamily: {
      sans: ['var(--font-inter)', 'var(--font-noto-sans-jp)', '"Hiragino Kaku Gothic ProN"', 'sans-serif'],
    },
    extend: {
      // 09 §視覚: チャコール背景・明るい文字・淡い紫の主操作
      colors: {
        studio: {
          bg: "var(--studio-bg)",
          surface: "var(--studio-surface)",
          raised: "var(--studio-raised)",
          stroke: "var(--studio-stroke)",
          text: "var(--studio-text)",
          muted: "var(--studio-muted)",
          accent: "var(--studio-accent)",
          "accent-ink": "var(--studio-accent-ink)",
          good: "var(--studio-good)",
          warn: "var(--studio-warn)",
          danger: "var(--studio-danger)",
        },
      },
      borderRadius: {
        studio: "20px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
