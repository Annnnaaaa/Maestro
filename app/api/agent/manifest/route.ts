import { corsPreflight, withCors } from "@/lib/cors";
import { maestroManifest } from "@/lib/maestro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  return withCors(maestroManifest());
}
