const path = require("path");

module.exports = {
  content: [
    path.join(__dirname, "pages/**/*.{js,jsx}"),
    path.join(__dirname, "components/**/*.{js,jsx}"),
    path.join(__dirname, "store/**/*.{js,jsx}"),
    path.join(__dirname, "lib/**/*.{js,jsx}")
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#edfdf7",
          100: "#d2f8e9",
          500: "#25d366",
          600: "#1ea952",
          700: "#167b3c"
        },
        ink: {
          900: "#111b21",
          800: "#202c33",
          700: "#2a3942",
          500: "#667781",
          200: "#d1d7db",
          100: "#e9edef",
          50: "#f0f2f5"
        }
      },
      boxShadow: {
        panel: "0 1px 3px rgba(17, 27, 33, 0.08), 0 8px 24px rgba(17, 27, 33, 0.06)"
      }
    }
  },
  plugins: []
};
