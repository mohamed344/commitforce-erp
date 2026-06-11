// C.D.C → QTE extraction (AI/OCR) powered by Google Gemini.
//
// Reads a PDF or image of the cahier des charges / devis quantitatif and returns
// structured QTE lines. The API key is read SERVER-SIDE ONLY from the environment
// (GEMINI_API_KEY or GOOGLE_API_KEY) — it is never sent to the browser. Get a free
// key at https://aistudio.google.com/apikey and put it in .env.local:
//   GEMINI_API_KEY=...
// Optional model override: GEMINI_MODEL=gemini-2.0-flash (default).
//
// If no key is set, returns { configured: false } so the UI falls back to CSV
// import / manual entry.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export type QteLine = { designation: string; qty?: number; uom?: string };

const PROMPT = [
  "You are extracting a quantitative estimate (QTE / devis quantitatif) from a",
  "construction or electrical project specification (Cahier des Charges).",
  "Read the document (it may be in French) and extract EVERY line item.",
  "For each item return: `designation` (the item label, keep the original language),",
  "`qty` (the quantity as a number, 0 if not stated), and `uom` (the unit such as U,",
  "ML, M3, Kg, Sac, Rouleau, Boîte, Pot — empty string if none).",
  "Ignore headers, totals, page numbers and section titles that are not real items.",
].join(" ");

const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      designation: { type: "STRING" },
      qty: { type: "NUMBER" },
      uom: { type: "STRING" },
    },
    required: ["designation"],
  },
};

function guessMime(name: string, type: string): string {
  if (type) return type;
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ configured: false });
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = guessMime(file.name, file.type);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: `Gemini ${r.status}: ${detail.slice(0, 500)}` }, { status: 502 });
    }
    const data = await r.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Could not parse AI response." }, { status: 502 });
    }
    const rawLines = Array.isArray(parsed) ? parsed : [];
    const lines: QteLine[] = rawLines
      .map((l: Record<string, unknown>) => ({
        designation: String(l?.designation ?? "").trim(),
        qty: Number(l?.qty) || 0,
        uom: l?.uom ? String(l.uom).trim() : undefined,
      }))
      .filter((l) => l.designation.length > 0);

    return NextResponse.json({ configured: true, lines });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
