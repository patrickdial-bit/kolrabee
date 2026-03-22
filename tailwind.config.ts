import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef7ee",
          100: "#fdebd3",
          200: "#fad4a6",
          300: "#f6b56e",
          400: "#f19035",
          500: "#E8780A",
          600: "#d96908",
          700: "#b4510b",
          800: "#904110",
          900: "#743710",
          950: "#3f1a06",
        },
        ember: {
          DEFAULT: "#E8780A",
          dark: "#1C1208",
          light: "#fdebd3",
        },
        forest: {
          DEFAULT: "#1B4D2E",
          light: "#e6f0ea",
          50: "#e6f0ea",
          100: "#c0d9ca",
          200: "#96bfa8",
          300: "#6ba585",
          400: "#4d8a6a",
          500: "#2f7050",
          600: "#1B4D2E",
          700: "#164025",
          800: "#11331d",
          900: "#0c2614",
        },
        forge: {
          DEFAULT: "#2D2D2D",
          light: "#737373",
        },
        canvas: {
          DEFAULT: "#F5F0E8",
          dark: "#e8e0d0",
        },
      },
      fontFamily: {
        display: [
          '"Barlow Condensed"',
          "system-ui",
          "sans-serif",
        ],
        sans: [
          '"DM Sans"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
