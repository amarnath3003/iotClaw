/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'DM Serif Display'", "serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        claw: {
          bg: "#0d0f12",
          surface: "#13161b",
          border: "#1e2229",
          muted: "#2a2f38",
          accent: "#00e5a0",
          accentdim: "#00a372",
          amber: "#f5a623",
          blue: "#4a9eff",
          text: "#e8eaed",
          sub: "#7a8494",
        }
      },
      keyframes: {
        fadeup: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulse_dot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" }
        }
      },
      animation: {
        fadeup: "fadeup 0.25s ease forwards",
        pulse_dot: "pulse_dot 1.2s ease-in-out infinite"
      }
    }
  },
  plugins: []
}
