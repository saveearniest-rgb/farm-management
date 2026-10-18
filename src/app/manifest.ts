import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shamba",
    short_name: "Shamba",
    description: "Farm operations, crop cycles, and costs in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#173f35",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
