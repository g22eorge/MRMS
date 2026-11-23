import type { MetadataRoute } from "next";

/**
 * Lets the app be added to a phone's home screen and opened full-screen, like
 * an installed app. It still needs a connection: there is no offline mode.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Duuka ProMax",
    short_name: "Duuka",
    description: "Sales, stock, repairs and accounts for your business.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
