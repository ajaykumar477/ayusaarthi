import { listDomains } from "@/lib/qdrant";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ domains: await listDomains() });
  } catch {
    return Response.json({ domains: [] });
  }
}
