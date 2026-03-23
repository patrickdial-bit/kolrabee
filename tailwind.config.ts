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
          50: "#e6f7f5",
          100: "#b3e8e3",
          200: "#80d9d0",
          300: "#4dcabd",
          400: "#26bfaf",
          500: "#00A896",
          600: "#008F7E",
          700: "#007566",
          800: "#005c4f",
          900: "#004237",
          950: "#002920",
        },
        ember: {
          DEFAULT: "#00A896",
          dark: "#0D1B2A",
          light: "#e6f7f5",
        },
        forest: {
          DEFAULT: "#0D1B2A",
          light: "#e8ecf0",
          50: "#e8ecf0",
          100: "#c5cdd6",
          200: "#9eabba",
          300: "#77899e",
          400: "#5a6f89",
          500: "#3d5574",
          600: "#0D1B2A",
          700: "#0b1724",
          800: "#09121d",
          900: "#060d16",
        },
        forge: {
          DEFAULT: "#2D2D2D",
          light: "#737373",
        },
        canvas: {
          DEFAULT: "#F0F5F5",
          dark: "#E4EEEE",
        },
      },
      fontFamily: {
        display: [
          '"Rajdhani"',
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
