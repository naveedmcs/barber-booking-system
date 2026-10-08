/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./dashboard/**/*.html",
    "./src/js/**/*.js",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        dark: {
          bg: "#0B0F17",
          card: "#111827",
          border: "#1F2937",
        },
        luxury: {
          gold: "#F59E0B",
          goldHover: "#D97706",
          goldLight: "rgba(245, 158, 11, 0.1)",
          emerald: "#10B981",
        },
      },
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans Arabic", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
  ],
};
