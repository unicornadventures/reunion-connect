/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4CAF50",
        secondary: "#2196F3",
        dark: "#333333",
        gray: "#666666",
        "light-gray": "#999999",
        border: "#E0E0E0",
        background: "#F5F5F5",
      },
    },
  },
  plugins: [],
}
