// src/lib/ratelimit.ts
// Tiny in-memory sliding-window rate limiter (per server process).
// Good enough for a single-instance deployment. For multiple instances use Redis/Upstash.

type Rule = { limit: number; windowMs: number };

const hits = new Map<string, number[]>();
let lastSweep = 0;

export function clientIp(req: Request): string {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimit(key: string, rules: Rule[]): { ok: boolean; retryAfter: number } {
    const now = Date.now();
    const maxWindow = Math.max(...rules.map((r) => r.windowMs));
    const stamps = (hits.get(key) ?? []).filter((t) => now - t < maxWindow);

    for (const rule of rules) {
        const inWindow = stamps.filter((t) => now - t < rule.windowMs);
        if (inWindow.length >= rule.limit) {
            const retryAfter = Math.max(1, Math.ceil((inWindow[0] + rule.windowMs - now) / 1000));
            hits.set(key, stamps);
            return { ok: false, retryAfter };
        }
    }

    stamps.push(now);
    hits.set(key, stamps);

    // Occasionally drop idle keys so the map cannot grow forever.
    if (now - lastSweep > 10 * 60 * 1000) {
        lastSweep = now;
        for (const [k, v] of hits) {
            if (!v.length || now - v[v.length - 1] > maxWindow) hits.delete(k);
        }
    }
    return { ok: true, retryAfter: 0 };
}