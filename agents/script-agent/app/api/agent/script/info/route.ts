import { corsPreflight, withCors } from "@/lib/cors";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors({
    id: "script-agent",
    fee_sats: 12,
    specialty: "15s product video scripts (max 50 words)",
    status: "available",
  });
}
