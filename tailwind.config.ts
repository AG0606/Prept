import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        'surface-warm': "var(--surface-warm)",
        'surface-raised': "var(--surface-raised)",
        fg: "var(--fg)",
        'fg-muted': "var(--fg-muted)",
        'fg-subtle': "var(--fg-subtle)",
        border: "var(--border)",
        'border-soft': "var(--border-soft)",
        accent: "var(--accent)",
        'accent-on': "var(--accent-on)",
        'accent-hover': "var(--accent-hover)",
        'accent-muted': "var(--accent-muted)",
        secondary: "var(--secondary)",
        tertiary: "var(--tertiary)",
        success: "var(--success)",
        'success-muted': "var(--success-muted)",
        warn: "var(--warn)",
        'warn-muted': "var(--warn-muted)",
        danger: "var(--danger)",
        'danger-muted': "var(--danger-muted)",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
        grotesk: ['var(--font-grotesk)', 'Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'ring': 'var(--elev-ring)',
        'sm': 'var(--elev-sm)',
        'md': 'var(--elev-md)',
        'raised': 'var(--elev-raised)',
        'float': 'var(--elev-float)',
        'glow': '0 0 24px var(--accent-glow)',
        'glow-lg': '0 0 48px var(--accent-glow)',
      },
      animation: {
        'marquee': 'marquee 25s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in-up-delay-1': 'fade-in-up 0.6s ease-out 0.1s forwards',
        'fade-in-up-delay-2': 'fade-in-up 0.6s ease-out 0.2s forwards',
        'fade-in-up-delay-3': 'fade-in-up 0.6s ease-out 0.3s forwards',
        'orb-float': 'orb-float 20s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'count-up': 'count-up 0.5s ease-out forwards',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)',
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-mesh': 'var(--gradient-mesh)',
      },
    },
  },
  plugins: [],
};
export default config;
