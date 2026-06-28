export const theme = {
  colors: {
    background: "#F6F7FB",
    card: "#FFFFFF",
    text: "#111827",
    muted: "#6B7280",
    border: "rgba(17,24,39,0.08)",
    primary: "#5B5FEF",
    primaryDark: "#4B4FE3",

    // ✅ Add these so UI screens compile
    success: "#10B981",
    error: "#EF4444",
    info: "#3B82F6",
  },
  font: {
    regular: "Roboto_400Regular",
    medium: "Roboto_500Medium",
    bold: "Roboto_700Bold",
  },
  radius: {
    xl: 24,
    lg: 18,
    md: 14,
  },
} as const;

export type AppTheme = typeof theme;
