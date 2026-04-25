import { corsPreflight, withCors } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({
    id: "visual-agent",
    fee_sats: 80,
    specialty: "Flux stills + FFmpeg slideshow (optional audio sync)",
    status: "available",
  });
}
