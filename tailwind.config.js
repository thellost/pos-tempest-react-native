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
          DEFAULT: "#F8FAFC",
          soft: "#FFFFFF",
          card: "#F1F5F9",
          raised: "#E2E8F0",
        },
        border: {
          DEFAULT: "#CBD5E1",
          focus: "#2A7FFF",
        },
        pos: {
          success: "#16A34A",
          warning: "#D97706",
          danger: "#DC2626",
          muted: "#64748B",
          text: "#1E293B",
          "text-strong": "#0F172A",
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