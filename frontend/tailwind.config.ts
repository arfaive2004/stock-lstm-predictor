import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0E16",
        panel: "#121826",
        "panel-raised": "#171F30",
        hairline: "rgba(237, 239, 243, 0.09)",
        paper: "#EDEFF3",
        mist: "#8B93A3",
        amber: {
          DEFAULT: "#E3A857",
          soft: "rgba(227, 168, 87, 0.14)",
          dim: "#B58542",
        },
        rally: "#4FBE8E",
        drop: "#E2685C",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(237,239,243,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(237,239,243,0.045) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "36px 36px",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.82)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        rise: "rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
