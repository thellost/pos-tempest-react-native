/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Toast POS-inspired palette
        brand: {
          DEFAULT: "#2A7FFF",
          hover: "#3F8CFF",
          press: "#1F6AE0",
        },
        surface: {
          DEFAULT: "#0B1220",
          soft: "#121C2E",
          card: "#162032",
          raised: "#1A2740",
        },
        border: {
          DEFAULT: "#1E293B",
          focus: "#2A7FFF",
        },
        pos: {
          success: "#18A957",
          warning: "#F59E0B",
          danger: "#EF4444",
          muted: "#94A3B8",
          text: "#E2E8F0",
          "text-strong": "#F8FAFC",
        },
      },
      borderRadius: {
        card: "12px",
      },
      fontSize: {
        "pos-xs": ["12px", "16px"],
        "pos-sm": ["14px", "20px"],
        "pos-base": ["16px", "24px"],
        "pos-lg": ["18px", "28px"],
        "pos-xl": ["20px", "28px"],
        "pos-2xl": ["24px", "32px"],
        "pos-3xl": ["28px", "36px"],
      },
      spacing: {
        "pos-touch": "48px", // Minimum touch target
      },
    },
  },
  plugins: [],
};