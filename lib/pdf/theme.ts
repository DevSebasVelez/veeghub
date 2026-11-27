import path from "node:path";

import { Font, StyleSheet } from "@react-pdf/renderer";

// Fonts and logo ship with the repo (lib/pdf) and are traced into the server
// bundle through `outputFileTracingIncludes` in next.config.ts.
const ASSETS = path.join(process.cwd(), "lib/pdf");

let registered = false;

export function registerPdfFonts() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Geist",
    fonts: [
      { src: path.join(ASSETS, "fonts/Geist-Regular.ttf"), fontWeight: 400 },
      { src: path.join(ASSETS, "fonts/Geist-Medium.ttf"), fontWeight: 500 },
      { src: path.join(ASSETS, "fonts/Geist-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "GeistMono",
    src: path.join(ASSETS, "fonts/GeistMono-Regular.ttf"),
  });
  // Words are never split with hyphens: names and references read whole.
  Font.registerHyphenationCallback((word) => [word]);
}

export const LOGO_PATH = path.join(ASSETS, "assets/veegsoft-logo.png");
/** Wordmark cropped from the horizontal logo: 1672×410 px. */
export const LOGO_RATIO = 1672 / 410;

export const C = {
  ink: "#0A0A0A",
  body: "#404040",
  muted: "#737373",
  faint: "#A3A3A3",
  line: "#E5E5E5",
  soft: "#FAFAFA",
  emerald: "#047857",
  emeraldWash: "#ECFDF5",
  blue: "#1D4ED8",
  blueWash: "#EFF6FF",
  red: "#B91C1C",
  redWash: "#FEF2F2",
  amber: "#B45309",
  amberWash: "#FFFBEB",
};

export const PAGE_X = 52;
export const LEADING = 1.45;

export const s = StyleSheet.create({
  page: {
    fontFamily: "Geist",
    fontSize: 9.5,
    color: C.ink,
    paddingTop: 48,
    paddingBottom: 76,
    paddingHorizontal: PAGE_X,
    // No page-wide lineHeight: react-pdf drops `render` text (page numbers)
    // that inherits one. Multi-line texts set their own (LEADING).
  },
  label: {
    fontSize: 7.5,
    fontWeight: 500,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  mono: { fontFamily: "GeistMono" },
  hairline: { height: 0.6, backgroundColor: C.line },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: 600,
    color: C.ink,
    marginBottom: 10,
  },
  row: { flexDirection: "row" },
});
