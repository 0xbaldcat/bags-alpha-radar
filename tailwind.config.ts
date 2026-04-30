import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#121417",
        panel: "#f7f4ef",
        field: "#ebe7dd",
        amber: "#d89a25",
        green: "#1d8f63",
        red: "#c94c3d"
      },
      boxShadow: {
        line: "0 0 0 1px rgba(18, 20, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
