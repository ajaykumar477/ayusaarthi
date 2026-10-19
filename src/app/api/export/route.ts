// src/app/api/export/route.ts
// Converts a Markdown answer into a real Word (.docx) file.
import { NextRequest } from "next/server";
import { marked, type Token, type Tokens } from "marked";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    LevelFormat,
} from "docx";

export const runtime = "nodejs";

const decode = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

type Style = { bold?: boolean; italics?: boolean };

function inline(tokens: Token[] | undefined, style: Style = {}): TextRun[] {
    const runs: TextRun[] = [];
    for (const t of tokens ?? []) {
        switch (t.type) {
            case "strong":
                runs.push(...inline((t as Tokens.Strong).tokens, { ...style, bold: true }));
                break;
            case "em":
                runs.push(...inline((t as Tokens.Em).tokens, { ...style, italics: true }));
                break;
            case "del":
            case "link":
                runs.push(...inline((t as Tokens.Link).tokens, style));
                break;
            case "codespan":
                runs.push(new TextRun({ text: decode((t as Tokens.Codespan).text), font: "Consolas", ...style }));
                break;
            case "br":
                runs.push(new TextRun({ break: 1 }));
                break;
            case "text": {
                const tt = t as Tokens.Text;
                if (tt.tokens?.length) runs.push(...inline(tt.tokens, style));
                else runs.push(new TextRun({ text: decode(tt.text), ...style }));
                break;
            }
            default:
                if ("text" in t) runs.push(new TextRun({ text: decode(String((t as { text: string }).text)), ...style }));
        }
    }
    return runs;
}

const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
];

function blocks(tokens: Token[], level: number, ctx: { n: number }): (Paragraph | Table)[] {
    const out: (Paragraph | Table)[] = [];
    for (const t of tokens) {
        switch (t.type) {
            case "heading": {
                const h = t as Tokens.Heading;
                out.push(
                    new Paragraph({
                        heading: HEADINGS[Math.min(h.depth, 6) - 1],
                        children: inline(h.tokens),
                        spacing: { before: 240, after: 120 },
                    })
                );
                break;
            }
            case "paragraph":
                out.push(new Paragraph({ children: inline((t as Tokens.Paragraph).tokens), spacing: { after: 120 } }));
                break;
            case "list": {
                const l = t as Tokens.List;
                const instance = ++ctx.n;
                const lvl = Math.min(level, 3);
                for (const item of l.items) {
                    const head = item.tokens.filter((x) => x.type === "text" || x.type === "paragraph");
                    const rest = item.tokens.filter((x) => x.type !== "text" && x.type !== "paragraph");
                    const children = head.flatMap((x) => inline((x as Tokens.Text).tokens ?? [x]));
                    out.push(
                        new Paragraph({
                            children,
                            spacing: { after: 60 },
                            ...(l.ordered
                                ? { numbering: { reference: "num", level: lvl, instance } }
                                : { bullet: { level: lvl } }),
                        })
                    );
                    out.push(...blocks(rest, level + 1, ctx));
                }
                break;
            }
            case "table": {
                const tb = t as Tokens.Table;
                const row = (cells: Tokens.TableCell[], header: boolean) =>
                    new TableRow({
                        tableHeader: header,
                        children: cells.map(
                            (c) =>
                                new TableCell({
                                    width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
                                    children: [new Paragraph({ children: inline(c.tokens, header ? { bold: true } : {}) })],
                                })
                        ),
                    });
                out.push(
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [row(tb.header, true), ...tb.rows.map((r) => row(r, false))],
                    })
                );
                out.push(new Paragraph({ text: "" }));
                break;
            }
            case "code":
                for (const line of decode((t as Tokens.Code).text).split("\n")) {
                    out.push(new Paragraph({ children: [new TextRun({ text: line, font: "Consolas" })] }));
                }
                break;
            case "hr":
                out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } } }));
                break;
            case "blockquote":
                out.push(...blocks((t as Tokens.Blockquote).tokens, level, ctx));
                break;
            case "space":
                break;
            default:
                if ("text" in t) out.push(new Paragraph({ children: [new TextRun(decode(String((t as { text: string }).text)))] }));
        }
    }
    return out;
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const markdown = typeof body?.markdown === "string" ? body.markdown.trim() : "";
    if (!markdown) return Response.json({ error: "Nothing to export." }, { status: 400 });

    const title = typeof body?.title === "string" && body.title ? body.title.slice(0, 120) : "AYUSaarthi";
    const tokens = marked.lexer(markdown);

    const levels = [0, 1, 2, 3].map((i) => ({
        level: i,
        format: LevelFormat.DECIMAL,
        text: `%${i + 1}.`,
        alignment: "left" as const,
        style: { paragraph: { indent: { left: 720 + i * 360, hanging: 360 } } },
    }));

    const doc = new Document({
        creator: "AYUSaarthi",
        title,
        styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
        numbering: { config: [{ reference: "num", levels }] },
        sections: [
            {
                children: [
                    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
                    ...blocks(tokens, 0, { n: 0 }),
                    new Paragraph({
                        spacing: { before: 360 },
                        children: [
                            new TextRun({
                                text: "Generated by AYUSaarthi. General information, not legal advice. Check the original documents before any filing.",
                                italics: true,
                                size: 18,
                                color: "666666",
                            }),
                        ],
                    }),
                ],
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    return new Response(new Uint8Array(buffer), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": 'attachment; filename="AYUSaarthi-answer.docx"',
        },
    });
}