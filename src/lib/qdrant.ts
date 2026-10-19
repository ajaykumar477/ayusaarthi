// src/lib/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION = process.env.COLLECTION_NAME ?? "ayusaarthi_chunks";

const rawQdrantUrl = process.env.QDRANT_URL ?? "";
const cleanQdrantUrl = rawQdrantUrl
  .trim()
  .replace(/^["']|["']$/g, "")
  .replace(/\/dashboard.*$/i, "")
  .replace(/\/+$/, "");

export const qdrant = new QdrantClient({
  url: cleanQdrantUrl || undefined,
  apiKey: (process.env.QDRANT_API_KEY ?? "").trim().replace(/^["']|["']$/g, "") || undefined,
});

export type ChunkPayload = {
  chunk_id: number;
  document_id: string;
  domain: string;
  chunk_type: string;
  section_label: string;
  chunk_order: number;
  chunk_text: string;
  char_count: number;
  // Optional fields: add them at ingest time to get date-aware ranking.
  effective_date?: string;
  superseded_by?: string;
};

export type Hit = { id: string | number; score: number; payload: ChunkPayload };

type SearchOptions = {
  limit?: number;
  minScore?: number;
  domain?: string;
  documentId?: string;
  chunkType?: string;
};

function describe(e: unknown): string {
  const base = e instanceof Error ? e.message : String(e);
  const data = (e as { data?: unknown })?.data;
  return data ? `${base} ${JSON.stringify(data).slice(0, 400)}` : base;
}

// ---------------------------------------------------------------------------
// Payload indexes.
// Qdrant (especially Qdrant Cloud) rejects filtered queries on un-indexed fields
// with "400 Bad Request". That is what made every domain-filtered query fail.
// We create the keyword indexes once, automatically. It is safe to call repeatedly.
// ---------------------------------------------------------------------------
const INDEX_FIELDS = ["domain", "document_id", "chunk_type"] as const;
let indexState: { ok: boolean; at: number } | null = null;
let indexPromise: Promise<void> | null = null;

async function ensureIndexes(): Promise<void> {
  if (indexState?.ok) return;
  if (indexState && Date.now() - indexState.at < 60_000) return; // failed recently, don't hammer

  if (!indexPromise) {
    indexPromise = (async () => {
      let ok = true;
      for (const field of INDEX_FIELDS) {
        try {
          await qdrant.createPayloadIndex(COLLECTION, {
            field_name: field,
            field_schema: "keyword",
            wait: true,
          });
        } catch (e) {
          ok = false;
          console.error(`[Qdrant] Could not create payload index on "${field}":`, describe(e));
        }
      }
      indexState = { ok, at: Date.now() };
      if (ok) console.log("[Qdrant] Payload indexes ready:", INDEX_FIELDS.join(", "));
    })().finally(() => {
      indexPromise = null;
    });
  }
  await indexPromise;
}

type Points = Awaited<ReturnType<typeof qdrant.query>>["points"];

/**
 * Dense search + optional payload filters.
 * If the filtered query still fails (for example the API key cannot create indexes),
 * we fall back to an unfiltered search and filter the results in code, so a domain
 * selection never produces a dead chat.
 */
export async function searchChunks(vector: number[], opts: SearchOptions = {}): Promise<Hit[]> {
  const limit = opts.limit ?? 8;
  const must = [
    opts.domain && { key: "domain", match: { value: opts.domain } },
    opts.documentId && { key: "document_id", match: { value: opts.documentId } },
    opts.chunkType && { key: "chunk_type", match: { value: opts.chunkType } },
  ].filter(Boolean) as { key: string; match: { value: string } }[];

  if (must.length) await ensureIndexes();

  const run = (filter: { must: typeof must } | undefined, lim: number) =>
    qdrant.query(COLLECTION, {
      query: vector,
      limit: lim,
      filter,
      score_threshold: opts.minScore || undefined,
      with_payload: true,
    });

  let points: Points;
  try {
    points = (await run(must.length ? { must } : undefined, limit)).points;
  } catch (e) {
    if (!must.length) throw e;
    console.error("[Qdrant] Filtered search failed, using client-side filtering:", describe(e));
    const wide = (await run(undefined, Math.min(limit * 10, 250))).points;
    points = wide
      .filter((p) => {
        const pl = (p.payload ?? {}) as Record<string, unknown>;
        return (
          (!opts.domain || pl.domain === opts.domain) &&
          (!opts.documentId || pl.document_id === opts.documentId) &&
          (!opts.chunkType || pl.chunk_type === opts.chunkType)
        );
      })
      .slice(0, limit);
  }

  return points.map((p) => ({
    id: p.id,
    score: p.score,
    payload: p.payload as unknown as ChunkPayload,
  }));
}

// Distinct `domain` values for the filter dropdown (cached for an hour).
type Offset = Awaited<ReturnType<typeof qdrant.scroll>>["next_page_offset"];
let domainCache: { at: number; values: string[] } | null = null;

export async function listDomains(): Promise<string[]> {
  if (domainCache && Date.now() - domainCache.at < 3_600_000) return domainCache.values;

  const found = new Set<string>();
  let offset: Offset = undefined;
  do {
    const page = await qdrant.scroll(COLLECTION, {
      limit: 1000,
      offset,
      with_payload: ["domain"],
      with_vector: false,
    });
    for (const p of page.points) {
      const d = p.payload?.domain;
      if (typeof d === "string") found.add(d);
    }
    offset = page.next_page_offset;
  } while (offset !== null && offset !== undefined);

  const values = [...found].sort();
  domainCache = { at: Date.now(), values };
  return values;
}