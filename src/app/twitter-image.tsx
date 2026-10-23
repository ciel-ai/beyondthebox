import { shareImage } from "./og";

export const runtime = "nodejs";
export const alt = "Beyond the Limits — A Business Conclave 2026. 20 December 2026.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return shareImage();
}
