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
        toast: {
          orange: {
            1: "#8f5f3d",
            2: "#7e4116",
            3: "#803500",
            4: "#682d03",
          },
          terracotta: {
            1: "#7e635d",
            2: "#74504D",
            3: "#722e25",
            4: "#561408",
          },
          yellow: {
            1: "#7e6b44",
            2: "#7b5f27",
            3: "#7c5000",
            4: "#633d09",
          },
          grass: {
            1: "#657552",
            2: "#556e34",
            3: "#37570a",
            4: "#113a00",
          },
          sky: {
            1: "#637486",
            2: "#4d6074",
            3: "#2a456b",
            4: "#213554",
          },
          lavender: {
            1: "#78668a",
            2: "#5e4776",
            3: "#402960",
            4: "#25174f",
          },
          gray: {
            1: "#6c6c6c",
            2: "#5f5f5f",
            3: "#474747",
            4: "#404040",
            DEFAULT: "#334155",
          },
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
        "pos-touch": "48px",
      },
    },
  },
  plugins: [],
};
