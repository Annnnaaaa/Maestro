import { corsPreflight, withCors } from "@/lib/cors";
import { maestroManifest } from "@/lib/maestro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

export async function GET() {
  try {
    return withCors(maestroManifest());
  } catch (e) {
    return withCors(
      { error: "manifest_failed", message: (e as Error).message },
      { status: 500 }
    );
  }
}
