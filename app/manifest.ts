import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Veeghub Operaciones",
    short_name: "Veeghub",
    description:
      "Panel de administración de operaciones, proyectos y finanzas.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: "#1c1c1c",
    lang: "es",
    categories: ["productivity", "business", "finance"],
    prefer_related_applications: false,
    // Separate files per purpose. Declaring one transparent image as both left
    // the launcher compositing a dark logo onto its own light background, and
    // cropping the maskable version into the artwork.
    icons: [
      {
        // Full bleed: the launcher crops this to its own shape, so the artwork
        // sits inside the central safe zone.
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        // Shown as-is, so it carries its own rounded corners.
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Leads", url: "/admin/leads" },
      { name: "Campañas", url: "/admin/campanas" },
      { name: "Dashboard", url: "/admin" },
      { name: "Finanzas", url: "/admin/finanzas" },
    ],
  };
}
