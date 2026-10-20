import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wattle",
    short_name: "Wattle",
    description: "Find a Queensland provider who fits you.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/figma/leaf.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
