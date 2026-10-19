// src/lib/embeddings.ts
const EXPECTED_DIM = 1024; // bge-m3 dense vector size
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Embeds a search query with bge-m3 via any OpenAI-compatible /embeddings endpoint. */
export async function embedQuery(text: string): Promise<number[]> {
  const url = process.env.EMBEDDING_API_URL;
  if (!url) throw new Error("EMBEDDING_API_URL is not set in .env.local.");
  const key = process.env.EMBEDDING_API_KEY;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Content-Type": "application/json",
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          model: process.env.EMBEDDING_MODEL ?? "BAAI/bge-m3",
          input: text,
          encoding_format: "float",
        }),
      });

      if (!res.ok) {
        // Retry once on overload / server errors.
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          await sleep(400);
          continue;
        }
        throw new Error(
          `Embedding request failed (${res.status}). Check EMBEDDING_API_URL, EMBEDDING_API_KEY and EMBEDDING_MODEL.`
        );
      }

      const json = await res.json();
      const vector = json?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length !== EXPECTED_DIM) {
        throw new Error(
          `Expected a ${EXPECTED_DIM}-dimension embedding but got ${Array.isArray(vector) ? vector.length : "none"}. Is the endpoint serving bge-m3?`
        );
      }
      return vector;
    } catch (e) {
      lastError = e;
      const isNetwork = e instanceof Error && /fetch failed|timeout|aborted|ECONN|ENOTFOUND/i.test(e.message);
      if (attempt === 0 && isNetwork) {
        await sleep(400);
        continue;
      }
      throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Embedding failed.");
}