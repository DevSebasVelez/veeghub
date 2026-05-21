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
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/admin" },
      { name: "Proyectos", url: "/admin/proyectos" },
      { name: "Finanzas", url: "/admin/finanzas" },
    ],
  };
}
