// src/lib/nvidia.ts
// NVIDIA's OpenAI-compatible API with automatic model discovery and fallback.
// The free catalog changes often, so model IDs are discovered at runtime
// instead of being hard-coded.

const BASE = "https://integrate.api.nvidia.com/v1";
const API_KEY = process.env.NVIDIA_API_KEY ?? "";

const list = (v?: string) =>
    (v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

// Optional: pin models in .env.local (comma-separated, tried first), e.g.
//   NVIDIA_MODELS=mistralai/mistral-large-3,deepseek-ai/deepseek-v3.2
//   NVIDIA_FAST_MODELS=openai/gpt-oss-20b          (used for query rewrite + follow-ups)
const PINNED = list(process.env.NVIDIA_MODELS);
const FAST_PINNED = list(process.env.NVIDIA_FAST_MODELS);

// Not chat/answer models: skip these.
const EXCLUDE =
    /embed|rerank|retriev|guard|safety|content-safety|topic-control|reward|parse|vision|vlm|vila|clip|cosmos|riva|parakeet|whisper|canary|tts|asr|fugatto|maxine|translate|usdcode|coder|code|calibration|image|video|audio|paligemma|neva|kosmos|deplot|nemoguard|diffusion|stable|flux|sdxl|bge|e5|nv-/i;

// Earlier = preferred for ANSWERS. Larger, instruction-following models first.
const PREFERENCE: RegExp[] = [
    /nemotron.*ultra/i,
    /deepseek.*v3/i,
    /mistral-large/i,
    /qwen3\.5|qwen3-next|qwen3-235b|qwen3.*instruct/i,
    /kimi-k3/i,
    /llama-3\.1-405b/i,
    /glm-[45]/i,
    /gpt-oss-120b/i,
    /nemotron.*super/i,
    /llama-?4/i,
    /llama-3\.[13].*70b/i,
    /minimax/i,
    /gpt-oss-20b/i,
    /nemotron-3-nano/i,
    /gemma/i,
    /llama-3\.1-8b/i,
];

// Earlier = preferred for SMALL JOBS (query rewrite, follow-up suggestions). Small and quick.
const FAST_PREFERENCE: RegExp[] = [
    /gpt-oss-20b/i,
    /nemotron.*nano/i,
    /llama-3\.1-8b/i,
    /gemma.*(?:it|\d+b)/i,
    /mistral.*(?:small|nemo)/i,
    /llama-3\.[13].*70b/i,
    /gpt-oss-120b/i,
    /nemotron.*super/i,
];

const rankIn = (res: RegExp[], id: string) => {
    const i = res.findIndex((re) => re.test(id));
    return i === -1 ? 100 : i;
};

const dead = new Set<string>(); // models that returned 410/404 this session
const cooling = new Map<string, number>(); // model -> timestamp until which we skip it
let cache: { at: number; ids: string[] } | null = null;

async function discoverModels(): Promise<string[]> {
    if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.ids;

    const res = await fetch(`${BASE}/models`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!res || !res.ok) {
        console.error("[NVIDIA] Could not list models:", res?.status);
        return cache?.ids ?? [];
    }

    const json = await res.json().catch(() => null);
    const all: string[] = (json?.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
    const ids = all.filter((id) => !EXCLUDE.test(id));

    cache = { at: Date.now(), ids };
    console.log(`[NVIDIA] ${ids.length} candidate chat models discovered`);
    return ids;
}

function ordered(ids: string[], fast: boolean): string[] {
    const rank = (id: string) => rankIn(fast ? FAST_PREFERENCE : PREFERENCE, id);
    const sorted = ids.map((id) => ({ id, r: rank(id) })).sort((a, b) => a.r - b.r);
    if (fast) {
        const preferred = sorted.filter((x) => x.r < 100);
        return (preferred.length ? preferred : sorted).map((x) => x.id).slice(0, 8);
    }
    return sorted.map((x) => x.id).slice(0, 15);
}

/** Removes <think>…</think> blocks, including one that was cut off before it closed. */
export function stripThink(s: string): string {
    return s.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/, "").trim();
}

export type Msg = { role: string; content: string };

type Options = {
    messages: Msg[];
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    /** Use small, quick models (query rewriting, follow-ups). */
    fast?: boolean;
    /** Max wait for the model to start responding, per attempt. */
    timeoutMs?: number;
    /** Models to skip (for example one that already failed on this request). */
    exclude?: string[];
};

/** Tries models in order. Returns the first successful Response, or null. */
export async function callNvidia(
    opts: Options
): Promise<{ response: Response; model: string } | null> {
    if (!API_KEY) {
        console.error("[NVIDIA] NVIDIA_API_KEY is missing in .env.local");
        return null;
    }

    const fast = !!opts.fast;
    const maxAttempts = fast ? 4 : 6;
    const timeoutMs = opts.timeoutMs ?? (fast ? 12_000 : 40_000);

    const discovered = ordered(await discoverModels(), fast);
    const skip = new Set(opts.exclude ?? []);
    const all = [...new Set([...(fast ? FAST_PINNED : PINNED), ...discovered])].filter(
        (m) => !dead.has(m) && !skip.has(m)
    );
    const now = Date.now();
    const ready = all.filter((m) => (cooling.get(m) ?? 0) <= now);
    const candidates = ready.length ? ready : all;

    if (!candidates.length) {
        console.error("[NVIDIA] No usable models found.");
        return null;
    }

    let attempts = 0;
    for (const model of candidates) {
        if (opts.signal?.aborted || attempts >= maxAttempts) break;
        attempts++;
        console.log(`[NVIDIA] Trying ${model}${fast ? " (fast)" : ""}`);

        // Abort if the model does not start responding in time, or if the caller aborts.
        const ctrl = new AbortController();
        opts.signal?.addEventListener("abort", () => ctrl.abort(), { once: true });
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            ctrl.abort();
        }, timeoutMs);

        let response: Response | null = null;
        try {
            response = await fetch(`${BASE}/chat/completions`, {
                method: "POST",
                signal: ctrl.signal,
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    Accept: opts.stream ? "text/event-stream" : "application/json",
                },
                body: JSON.stringify({
                    model,
                    messages: opts.messages,
                    stream: !!opts.stream,
                    temperature: opts.temperature ?? 0.2,
                    max_tokens: opts.maxTokens ?? 3000,
                }),
            });
        } catch (e) {
            console.error(
                `[NVIDIA] ${model} ${timedOut ? `timed out after ${timeoutMs}ms` : "network error: " + (e instanceof Error ? e.message : e)}`
            );
            if (timedOut) cooling.set(model, Date.now() + 60_000);
        } finally {
            clearTimeout(timer);
        }

        if (!response) continue;
        console.log(`[NVIDIA] ${model} -> HTTP ${response.status}`);

        if (response.ok && response.body) return { response, model };

        const text = await response.text().catch(() => "");
        console.error(`[NVIDIA] ${model} failed:`, text.slice(0, 300));

        // Retired or unknown model: never try it again this session.
        if (response.status === 410 || response.status === 404) dead.add(model);
        // Overloaded or erroring: rest it for a short while so other requests skip it.
        else if (response.status === 429) cooling.set(model, Date.now() + 60_000);
        else if (response.status >= 500) cooling.set(model, Date.now() + 30_000);
    }

    // If everything we tried was dead, refresh the list next time.
    cache = null;
    return null;
}