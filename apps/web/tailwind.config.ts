import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import uiTokenPreset from "../../packages/ui/tokens/tailwind-preset";

const uiTokenColors = uiTokenPreset.theme?.extend?.colors ?? {};

const config: Config = {
  presets: [uiTokenPreset],
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...uiTokenColors,
        border: "var(--border)",
        input: "var(--surface-2)",
        ring: "var(--accent)",
        background: "var(--surface-1)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-fg)",
        },
        secondary: {
          DEFAULT: "var(--surface-2)",
          foreground: "var(--text-primary)",
        },
        muted: {
          DEFAULT: "var(--surface-3)",
          foreground: "var(--text-secondary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-fg)",
        },
        destructive: {
          DEFAULT: "var(--status-rejected)",
          foreground: "var(--accent-fg)",
        },
        card: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-primary)",
        },
        popover: {
          DEFAULT: "var(--surface-1)",
          foreground: "var(--text-primary)",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [animate],
};

export default config;
