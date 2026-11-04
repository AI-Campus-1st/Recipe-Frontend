import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "요리담",
    short_name: "요리담",
    description: "저장한 레시피로 주간 식단과 장보기를 계획합니다.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/yoridam-v2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/yoridam-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/yoridam-v2-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
