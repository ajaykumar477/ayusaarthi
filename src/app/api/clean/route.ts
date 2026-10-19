// src/app/api/clean/route.ts
// Two jobs: tidy one OCR passage ({ text }) and suggest follow-up questions ({ followups }).
import { NextRequest } from "next/server";
import { callNvidia, stripThink } from "@/lib/nvidia";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const PER_MIN = Number(process.env.CLEAN_RATE_PER_MIN ?? 30);

const CLEAN_PROMPT = `You help readers understand excerpts from Indian intellectual property and AYUSH regulatory documents. The excerpts were extracted from scanned PDFs, so the text is fragmented and noisy.

Rewrite the excerpt as a clear, well-organised explanation:
- Start with one bold line saying what the excerpt is about.
- Then present the content as short paragraphs and bullet points. Use numbered steps if it describes a process, and a Markdown table if it is tabular data.
- Rephrase broken fragments into complete, natural sentences. Fix scanning errors, stray symbols, page numbers and dotted lines.
- Keep every fact, Act, rule, section and form name, number, date, place and example. Do not add information, opinions or advice that is not in the excerpt.
- If the excerpt starts or ends in the middle of a sentence, write only what is clearly there and do not guess the missing part.
- Write in the same language as the excerpt. Output only the rewritten text.`;

const FOLLOWUP_PROMPT = `Suggest exactly 3 short follow-up questions a user might ask next, based on the question and answer given. Same language as the question. Each under 15 words. Reply with ONLY a JSON array of 3 strings, for example ["Question one?","Question two?","Question three?"]. No explanation.`;

async function complete(
    system: string,
    user: string,
    opts: { maxTokens: number; signal: AbortSignal; fast?: boolean; exclude?: string[] }
) {
    const result = await callNvidia({
        messages: [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        stream: false,
        temperature: 0.1,
        maxTokens: opts.maxTokens,
        fast: opts.fast,
        exclude: opts.exclude,
        timeoutMs: opts.fast ? 20_000 : 45_000,
        signal: opts.signal,
    });
    if (!result) return null;
    const json = await result.response.json().catch(() => null);
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { text: stripThink(text), model: result.model };
}

function parseFollowups(out: string): string[] {
    let list: unknown[] = [];
    try {
        const arr = out.match(/\[[\s\S]*\]/);
        if (arr) list = JSON.parse(arr[0]);
        else {
            const obj = out.match(/\{[\s\S]*\}/);
            if (obj) {
                const parsed = JSON.parse(obj[0]);
                list = (Object.values(parsed).find(Array.isArray) as unknown[]) ?? [];
            }
        }
    } catch {
        list = out
            .split("\n")
            .map((l) => l.replace(/^[-*\d.)\s"]+|["',\]]+$/g, "").trim())
            .filter((l) => l.length > 5 && l.endsWith("?"));
    }
    return list
        .filter((x): x is string => typeof x === "string" && x.trim().length > 3)
        .map((x) => x.trim().slice(0, 140))
        .slice(0, 3);
}

export async function POST(req: NextRequest) {
    const rl = rateLimit(`clean:${clientIp(req)}`, [{ limit: PER_MIN, windowMs: 60_000 }]);
    if (!rl.ok) {
        return Response.json(
            { error: "Too many requests. Please wait a moment." },
            { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
        );
    }

    const body = await req.json().catch(() => null);

    if (typeof body?.text === "string" && body.text.trim()) {
        const out = await complete(CLEAN_PROMPT, body.text.slice(0, 4000), {
            maxTokens: 3000,
            signal: req.signal,
        });
        if (!out?.text) return Response.json({ error: "Cleanup unavailable." }, { status: 502 });
        return Response.json({ text: out.text });
    }

    if (body?.followups?.question && body?.followups?.answer) {
        const question = String(body.followups.question).slice(0, 500);
        const answer = String(body.followups.answer).slice(0, 1500);
        const prompt = `Question: ${question}\n\nAnswer: ${answer}`;

        // Up to two tries on different models (a reasoning model can spend its whole
        // token budget thinking and return nothing).
        const tried: string[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
            const out = await complete(FOLLOWUP_PROMPT, prompt, {
                maxTokens: 700,
                signal: req.signal,
                fast: true,
                exclude: tried,
            });
            if (!out) break;
            tried.push(out.model);
            const followups = parseFollowups(out.text);
            if (followups.length) return Response.json({ followups });
            console.warn(`[clean] ${out.model} returned no usable follow-ups`);
        }
        return Response.json({ followups: [] });
    }

    return Response.json({ error: "Nothing to do." }, { status: 400 });
}