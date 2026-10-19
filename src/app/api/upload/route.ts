// src/app/api/upload/route.ts
// Extracts plain text from an uploaded PDF / Word / text file. Nothing is stored on the server.
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 150_000;

export async function POST(req: NextRequest) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
        return Response.json({ error: "No file received." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return Response.json({ error: "File is too large. The limit is 10 MB." }, { status: 413 });
    }

    const name = file.name || "document";
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const buf = Buffer.from(await file.arrayBuffer());

    let text = "";
    try {
        if (ext === "pdf") {
            const { extractText, getDocumentProxy } = await import("unpdf");
            const pdf = await getDocumentProxy(new Uint8Array(buf));
            const r = await extractText(pdf, { mergePages: true });
            text = Array.isArray(r.text) ? r.text.join("\n\n") : r.text;
        } else if (ext === "docx") {
            const m: any = await import("mammoth");
            const extract = m.extractRawText ?? m.default?.extractRawText;
            text = (await extract({ buffer: buf })).value;
        } else if (["txt", "md", "csv"].includes(ext)) {
            text = buf.toString("utf-8");
        } else {
            return Response.json(
                { error: "Unsupported file type. Please upload a PDF, Word (.docx) or text file." },
                { status: 415 }
            );
        }
    } catch (e) {
        console.error("[upload] parse error:", e instanceof Error ? e.message : e);
        return Response.json({ error: "Could not read this file. It may be damaged or password-protected." }, { status: 422 });
    }

    text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 20) {
        return Response.json(
            { error: "No readable text found. Scanned PDFs (images) are not supported yet." },
            { status: 422 }
        );
    }

    return Response.json({
        name,
        text: text.slice(0, MAX_CHARS),
        truncated: text.length > MAX_CHARS,
        chars: text.length,
    });
}