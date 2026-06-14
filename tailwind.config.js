/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1565C0",
        "primary-light": "#42A5F5",
        accent: "#FFC107"
      }
    }
  },
  plugins: [],
};
