"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./chat.css";

type Complexity = "simple" | "moderate" | "complex";

type Source = {
  n: number;
  score: number;
  domain: string;
  section_label: string;
  provision?: string | null;
  document_id: string;
  text: string;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  complexity?: Complexity | "";
  showSources?: boolean;
  followups?: string[];
  error?: string;
};

type UploadedFile = {
  name: string;
  text: string;
  chars: number;
  truncated: boolean;
};

// "on-open" = passages are only rewritten in plain language when the user opens the sources list.
// ("with-answer" rewrote every passage after every answer: many extra model calls per question.)
const REWRITE_MODE: "with-answer" | "after-answer" | "on-open" = "on-open";
const REWRITE_PARALLEL = 3;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "sa", label: "संस्कृतम् (Sanskrit)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "auto", label: "Auto-detect" },
];

const SUGGESTIONS_EN = [
  {
    topic: "Patents & TKDL",
    text: "How can traditional Ayurvedic knowledge be protected from wrongful patents?",
    icon: "shield",
  },
  {
    topic: "Patent Filing",
    text: "What documents and specifications are required to file a patent application in India?",
    icon: "document",
  },
  {
    topic: "Geographical Indications",
    text: "How are geographical indications (GI) registered for regional herbal products?",
    icon: "tag",
  },
  {
    topic: "Regulatory Compliance",
    text: "What are the statutory rules and restrictions for advertising AYUSH formulations?",
    icon: "scale",
  },
];

const SUGGESTIONS_HI = [
  {
    topic: "पेटेंट और TKDL",
    text: "पारंपरिक आयुर्वेदिक ज्ञान को अनुचित पेटेंट से कैसे सुरक्षित किया जा सकता है?",
    icon: "shield",
  },
  {
    topic: "पेटेंट फाइलिंग",
    text: "भारत में पेटेंट आवेदन दाखिल करने के लिए कौन से दस्तावेज आवश्यक हैं?",
    icon: "document",
  },
  {
    topic: "भौगोलिक उपदर्शन (GI)",
    text: "हर्बल उत्पादों के लिए भौगोलिक उपदर्शन (GI) पंजीकरण कैसे होता है?",
    icon: "tag",
  },
  {
    topic: "नियामक अनुपालन",
    text: "आयुष उत्पादों के विज्ञापन के लिए वैधानिक नियम और प्रतिबंध क्या हैं?",
    icon: "scale",
  },
];

const pretty = (d: string) =>
  d.replace(/^\d+_/, "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

const docLink = (id: string) =>
  /^[\w-]{20,}$/.test(id) ? `https://drive.google.com/file/d/${id}/view` : null;

const tidyAnswer = (t: string) =>
  t.replace(/【[^】]*】/g, "").replace(/\n+\W*Useful links[\s\S]*$/i, "").trimEnd();

// Prefer the provision detected from the passage itself ("3. What are not inventions").
// Internal chunk labels such as "ORDER (part 18)" only identify a position in the file.
const labelOf = (s: Source) =>
  s.provision
    ? s.provision
    : /^fallback/i.test(s.section_label)
      ? "Statutory Document Extract"
      : s.section_label;

const cleanText = (t: string) =>
  t
    .replace(/\r/g, "")
    .replace(/^\s*\d{1,4}\s*$/gm, "")
    .replace(/\n{2,}/g, "\u0000")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\u0000/g, "\n\n")
    .replace(/(?:\s*[.·•]){4,}/g, " … ")
    .replace(/(^|\s)\d{1,3}\s-\s/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md,.csv";

/**
 * Centered Sticky Watermark for Intellectual Property Rights (IPR)
 * Remains permanently fixed in the center of the viewport behind all content.
 */
function IprWatermark() {
  return (
    <div className="ipr-watermark-wrapper" aria-hidden="true">
      <svg
        className="ipr-watermark-svg"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer concentric rings */}
        <circle cx="250" cy="250" r="235" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 4" />
        <circle cx="250" cy="250" r="222" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="250" cy="250" r="150" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="250" cy="250" r="142" stroke="currentColor" strokeWidth="0.75" />

        {/* Circular text paths */}
        <defs>
          <path
            id="ipr-text-path-top"
            d="M 60,250 A 190,190 0 0,1 440,250"
            fill="none"
          />
          <path
            id="ipr-text-path-bottom"
            d="M 440,250 A 190,190 0 0,1 60,250"
            fill="none"
          />
        </defs>

        <text fill="currentColor" fontSize="13.5" fontWeight="600" letterSpacing="3.5" textAnchor="middle">
          <textPath href="#ipr-text-path-top" startOffset="50%">
            INTELLECTUAL PROPERTY RIGHTS
          </textPath>
        </text>

        <text fill="currentColor" fontSize="11" fontWeight="500" letterSpacing="3" textAnchor="middle">
          <textPath href="#ipr-text-path-bottom" startOffset="50%">
            • AYUSH LAW &amp; POLICY • STATUTORY FRAMEWORK •
          </textPath>
        </text>

        {/* Center decorative motif: Legal Scales */}
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
          {/* Balance beam */}
          <line x1="200" y1="185" x2="300" y2="185" />
          <line x1="250" y1="172" x2="250" y2="200" />
          {/* Left scale pan */}
          <path d="M 195 185 L 180 208 M 205 185 L 220 208" />
          <path d="M 175 208 Q 200 218 225 208 Z" fill="currentColor" fillOpacity="0.15" />
          {/* Right scale pan */}
          <path d="M 295 185 L 280 208 M 305 185 L 320 208" />
          <path d="M 275 208 Q 300 218 325 208 Z" fill="currentColor" fillOpacity="0.15" />
        </g>

        {/* Central Bold IPR Monogram */}
        <text
          x="250"
          y="275"
          fill="currentColor"
          fontSize="56"
          fontWeight="800"
          letterSpacing="4"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          IPR
        </text>

        <text
          x="250"
          y="300"
          fill="currentColor"
          fontSize="11.5"
          fontWeight="600"
          letterSpacing="2.5"
          textAnchor="middle"
        >
          PATENT • TKDL • GI • TRADEMARK
        </text>
      </svg>
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState("");
  const [language, setLanguage] = useState("en");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ayusaarthi_lang");
      if (saved) setLanguage(saved);
    } catch { }
  }, []);

  function handleLanguageChange(val: string) {
    setLanguage(val);
    try {
      localStorage.setItem("ayusaarthi_lang", val);
    } catch { }
  }

  useEffect(() => {
    fetch("/api/domains", {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
      .then((r) => r.json())
      .then((d) => setDomains(d.domains ?? []))
      .catch(() => { });
  }, []);

  function handleScroll() {
    const el = mainRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceToBottom < 80;
    isAtBottomRef.current = atBottom;
    setShowScrollBottom(!atBottom);
  }

  function scrollToBottom() {
    isAtBottomRef.current = true;
    setShowScrollBottom(false);
    mainRef.current?.scrollTo({
      top: mainRef.current.scrollHeight,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (isAtBottomRef.current && mainRef.current) {
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setUploadedFile(null);
    isAtBottomRef.current = true;
    setShowScrollBottom(false);
    fieldRef.current?.focus();
  }

  function removeFile() {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setUploadedFile({
        name: data.name,
        text: data.text,
        chars: data.chars,
        truncated: data.truncated,
      });
    } catch (e) {
      alert((e as Error).message || "Could not process the file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: question };
    const botId = crypto.randomUUID();
    const history = [...messages, userMsg];
    setMessages([
      ...history,
      { id: botId, role: "assistant", content: "", complexity: "", showSources: false },
    ]);
    setInput("");
    setLoading(true);

    isAtBottomRef.current = true;
    setShowScrollBottom(false);
    if (mainRef.current) {
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)));

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          domain: domain || undefined,
          language: language !== "en" ? language : undefined,
          fileContext: uploadedFile ? { name: uploadedFile.name, text: uploadedFile.text } : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Request failed (${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let hasSources = false;
      let hadError = false;
      let answerComplexity: Complexity | "" = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "sources") {
              hasSources = Array.isArray(evt.sources) && evt.sources.length > 0;
              patch((m) => ({ ...m, sources: evt.sources }));
            } else if (evt.type === "meta") {
              answerComplexity =
                evt.complexity === "simple" || evt.complexity === "moderate" || evt.complexity === "complex"
                  ? evt.complexity
                  : "";
              patch((m) => ({
                ...m,
                complexity: answerComplexity,
                showSources: evt.showSources === true,
              }));
            } else if (evt.type === "token") {
              answer += evt.text;
              patch((m) => ({ ...m, content: m.content + evt.text }));
            } else if (evt.type === "error") {
              hadError = true;
              patch((m) => ({ ...m, error: evt.message }));
            }
          } catch {
            /* ignore partial lines */
          }
        }
      }

      // One extra call for follow-up suggestions (skip for simple answers, greetings, errors and "not covered" answers).
      if (
        answer &&
        !hadError &&
        (hasSources || uploadedFile) &&
        answerComplexity !== "simple" &&
        !/do not cover this/i.test(answer)
      ) {
        fetch("/api/clean", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ followups: { question, answer: answer.slice(0, 1500) } }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d.followups) && d.followups.length) patch((m) => ({ ...m, followups: d.followups }));
          })
          .catch(() => { });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, error: (e as Error).message }));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="relative flex h-dvh flex-col bg-slate-50 font-sans text-slate-800 antialiased">
      {/* Sticky Centered IPR Watermark */}
      <IprWatermark />

      {/* Main Top Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          {/* Logo Badge */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-white shadow-xs">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-emerald-950">AYUSaarthi</h1>
              <span className="hidden rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase sm:inline-block">
                IPR & Statutory AI
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Guidance for Patents, TKDL, GI & Regulatory Compliance
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active KB indicator */}
          <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 status-pulse" />
            <span>Indexed legal documents</span>
          </div>

          {/* Language Selector Dropdown (Scenario A) */}
          <div className="relative flex items-center rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-2xs transition-colors hover:border-slate-400">
            <span className="mr-1 text-xs select-none" aria-hidden="true">🌐</span>
            <select
              aria-label="Select response language"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="cursor-pointer bg-transparent text-xs font-medium text-slate-700 focus:outline-none sm:text-sm"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Domain Filter Dropdown */}
          <div className="relative">
            <select
              aria-label="Filter legal domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="max-w-[130px] truncate rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-400 focus:border-emerald-600 focus:outline-none sm:max-w-xs sm:text-sm"
            >
              <option value="">All Legal Domains</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {pretty(d)}
                </option>
              ))}
            </select>
          </div>

          {/* New Conversation Button */}
          <button
            type="button"
            onClick={newChat}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-emerald-800 active:scale-97 sm:text-sm"
            title="Start a new conversation"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Chat</span>
          </button>
        </div>
      </header>

      {/* Main Conversation Stream */}
      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="relative z-10 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
          {/* Welcome Screen / Empty State */}
          {messages.length === 0 && (
            <div className="py-6 sm:py-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3.5 py-1 text-xs font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Independent Legal & IPR Assistant for AYUSH
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                How can I assist your AYUSH intellectual property inquiry?
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Get answers grounded in indexed Indian patent law, the Traditional Knowledge Digital Library (TKDL),
                the Drugs & Cosmetics Act, and geographical indication material, with links to the source documents.
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">
                This is an independent project, not an official service of the Ministry of AYUSH or the Indian Patent Office.
              </p>

              {/* Upload Document Hint */}
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-xs text-emerald-900 sm:text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </span>
                <div>
                  <span className="font-semibold">Have a patent specification or draft document?</span> Attach your PDF/DOCX using the clip button below to extract claims or compare it with the indexed legal requirements.
                </div>
              </div>

              {/* Suggested Questions Grid */}
              <div className="mt-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Suggested Legal & Regulatory Queries
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {(language === "hi" ? SUGGESTIONS_HI : SUGGESTIONS_EN).map((item) => (
                    <button
                      key={item.text}
                      type="button"
                      onClick={() => send(item.text)}
                      className="query-card group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 text-left text-sm shadow-2xs hover:border-emerald-600"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
                        <span>{item.topic}</span>
                        <svg className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-700 sm:text-sm">
                        {item.text}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Conversation Messages */}
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-900 px-4 py-3 text-sm leading-relaxed text-white shadow-xs sm:px-5 sm:text-base">
                    {m.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="flex flex-col gap-2">
                {m.content ? (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6">
                    {/* Bot header inside card */}
                    <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>AYUSaarthi Statutory Analysis</span>
                      </div>
                      {!(loading && isLast) && <CopyButton text={tidyAnswer(m.content)} />}
                    </div>

                    <Answer content={tidyAnswer(m.content)} streaming={loading && isLast} />

                    {/* Sources Accordion: the server decides when to show it */}
                    {!!m.sources?.length &&
                      m.showSources === true &&
                      !/do not cover this/i.test(m.content) && (
                        <Sources sources={m.sources} ready={!(loading && isLast)} />
                      )}
                  </div>
                ) : (
                  loading && isLast && !m.error && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-4 text-xs font-medium text-slate-500 shadow-2xs sm:text-sm">
                      <svg className="h-4 w-4 animate-spin text-emerald-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>
                        {m.sources?.length
                          ? "Found relevant documents. Writing the answer…"
                          : "Searching statutory AYUSH gazettes, TKDL records & patent acts…"}
                      </span>
                    </div>
                  )
                )}

                {/* Follow-up question pills */}
                {isLast && !loading && !!m.followups?.length && (
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <p className="text-xs font-semibold text-slate-500">Related Statutory Follow-ups:</p>
                    <div className="flex flex-wrap gap-2">
                      {m.followups.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-left text-xs font-medium text-emerald-900 shadow-2xs transition-all hover:border-emerald-600 hover:bg-emerald-50 active:scale-97"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {m.error && (
                  <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                    <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{m.error}</span>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="fixed bottom-24 right-6 z-30 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-md backdrop-blur-md transition-all hover:bg-slate-50 hover:shadow-lg active:scale-95 sm:right-8"
          aria-label="Scroll to newest message"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>Scroll to bottom</span>
        </button>
      )}

      {/* Footer / Input Dock */}
      <footer className="relative z-10 border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-xs backdrop-blur-md sm:px-6">
        {/* Attached file preview chip */}
        {uploadedFile && (
          <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 shadow-2xs">
              <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-semibold">{uploadedFile.name}</span>
              {uploadedFile.truncated && (
                <span className="text-amber-700 font-normal">
                  (very long file: only the first {uploadedFile.chars.toLocaleString()} characters were read)
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={removeFile}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Remove uploaded file"
              title="Remove document"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Uploading progress indicator */}
        {uploading && (
          <div className="mx-auto mb-2 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <svg className="h-3.5 w-3.5 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing and extracting document text…
            </span>
          </div>
        )}

        {/* Form Container */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-end gap-2"
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            id="file-upload-input"
            name="file-upload"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />

          {/* Attach file button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-shrink-0 rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 shadow-2xs transition-colors hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-40"
            aria-label="Upload document"
            title="Attach patent/doc (PDF, DOCX, TXT, CSV). Scanned image-only PDFs are not supported."
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Text input area */}
          <div className="relative flex-1">
            <textarea
              ref={fieldRef}
              id="question-input"
              name="question"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={
                uploadedFile
                  ? `Ask statutory or IP questions regarding "${uploadedFile.name}"…`
                  : "Ask an IP, patent, TKDL, or AYUSH regulatory question…"
              }
              aria-label="Your inquiry"
              className="max-h-40 w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-2xs placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none sm:text-base"
            />
          </div>

          {/* Action Button: Stop or Send */}
          {loading ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-2xs transition-colors hover:bg-red-100"
            >
              <span className="h-2 w-2 rounded-full bg-red-600" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs transition-all hover:bg-emerald-900 active:scale-97 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Ask</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          )}
        </form>

        {/* Legal Disclaimer */}
        <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-400">
          Independent project, not affiliated with the Ministry of AYUSH or the Indian Patent Office. Answers come from
          indexed documents that may not reflect the latest amendments. Not legal counsel. Verify with official gazettes.
        </p>
      </footer>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          })
          .catch(() => { })
      }
      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 transition-colors hover:text-emerald-950"
      title="Copy this response to clipboard"
    >
      {done ? (
        <>
          <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-700">Copied</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function Answer({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <div className={`md ${streaming ? "caret" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

type Phase = "idle" | "working" | "done" | "error";

function Sources({ sources, ready }: { sources: Source[]; ready: boolean }) {
  const [opened, setOpened] = useState(false);
  const [tidy, setTidy] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<Record<number, Phase>>({});
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (REWRITE_MODE === "on-open" && !(opened && ready)) return;
    if (REWRITE_MODE === "after-answer" && !ready) return;
    started.current = true;

    const setP = (n: number, p: Phase) => setPhase((x) => ({ ...x, [n]: p }));

    const rewrite = async (s: Source) => {
      setP(s.n, "working");
      try {
        const res = await fetch("/api/clean", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ text: s.text, stream: true }),
        });
        if (!res.ok) throw new Error("rewrite failed");

        let out = "";
        if ((res.headers.get("content-type") ?? "").includes("application/json")) {
          const d = await res.json();
          out = typeof d.text === "string" ? d.text : "";
          setTidy((t) => ({ ...t, [s.n]: out }));
        } else if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            out += decoder.decode(value, { stream: true });
            setTidy((t) => ({ ...t, [s.n]: out }));
          }
        }
        setP(s.n, out.trim() ? "done" : "error");
      } catch {
        setP(s.n, "error");
      }
    };

    runLimited(sources, REWRITE_PARALLEL, rewrite);
  }, [ready, opened, sources]);

  return (
    <details
      className="mt-4 rounded-xl border border-slate-200/90 bg-slate-50/70 text-sm transition-all"
      onToggle={(e) => {
        if (e.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between px-3.5 py-2.5 font-semibold text-emerald-900 hover:bg-slate-100/60">
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Statutory Sources & Cited Passages ({sources.length})
        </span>
        <span className="text-xs font-normal text-slate-500">Click to expand</span>
      </summary>
      <ul className="space-y-2.5 border-t border-slate-200/80 p-3.5">
        {sources.map((s) => (
          <li key={s.n} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 sm:text-sm">{labelOf(s)}</span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                {pretty(s.domain)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-emerald-800">
              {docLink(s.document_id) && (
                <a
                  href={docLink(s.document_id)!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-emerald-950"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open original document</span>
                </a>
              )}
            </div>
            <Passage s={s} tidy={tidy[s.n] ?? ""} phase={phase[s.n] ?? "idle"} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Passage({ s, tidy, phase }: { s: Source; tidy: string; phase: Phase }) {
  const waiting = phase === "working";
  return (
    <details className="group mt-2 border-t border-slate-100 pt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950">
        <span className="group-open:hidden">▶ View excerpt passage</span>
        <span className="hidden group-open:inline">▼ Hide excerpt passage</span>
      </summary>
      <div className="src mt-2.5 max-h-72 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-slate-700">
        {waiting && !tidy && (
          <p className="mb-2 flex items-center gap-1.5 animate-pulse text-xs text-slate-500">
            <svg className="h-3.5 w-3.5 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating plain-language explanation of passage…
          </p>
        )}
        <Answer content={tidy || cleanText(s.text)} streaming={phase === "working" && !!tidy} />
      </div>
      {phase === "done" && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          ✓ Plain-language rewrite of the excerpt, generated by AI. Consult the original document for the exact legal wording.
        </p>
      )}
      {phase === "error" && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Showing the cleaned excerpt directly from the indexed file.
        </p>
      )}
    </details>
  );
}