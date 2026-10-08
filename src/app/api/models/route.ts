import { getPublicModels } from "@/lib/llm/config";

export const dynamic = "force-dynamic";

/** Model list for the dropdown, from config/models.json. Exposes availability, never keys. */
export function GET() {
  return Response.json(getPublicModels());
}
