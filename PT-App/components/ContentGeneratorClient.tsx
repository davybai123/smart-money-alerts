"use client";
import { useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { ContentPiece } from "@/lib/store";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const CONTENT_TYPES = [
  { id: "youtube-script", label: "YouTube Script", icon: "▶", desc: "Full 8-12 min script with hook, body, CTA" },
  { id: "short-script", label: "YouTube Short / TikTok", icon: "⚡", desc: "30–60s punchy script" },
  { id: "instagram-caption", label: "Instagram Caption", icon: "📸", desc: "Caption + 30 hashtags" },
  { id: "twitter-thread", label: "Twitter Thread", icon: "𝕏", desc: "5-7 tweet thread" },
  { id: "facebook-post", label: "Facebook Post", icon: "f", desc: "Engaging long-form post" },
];

const PLATFORMS = [
  { id: "youtube", label: "YouTube", color: "#ff0000" },
  { id: "instagram", label: "Instagram", color: "#e1306c" },
  { id: "tiktok", label: "TikTok", color: "#69c9d0" },
  { id: "twitter", label: "Twitter / X", color: "#1d9bf0" },
  { id: "facebook", label: "Facebook", color: "#1877f2" },
];

const STAGES = [
  "Group Stage", "Round of 32", "Round of 16", "Quarter-Final",
  "Semi-Final", "Final", "Opening Match", "Friendly / Warm-up",
];

const ANGLES = [
  "Tactical breakdown", "Player spotlight", "Underdog story",
  "Prediction / Preview", "Match recap", "History & stats",
  "Controversial take", "Fan reaction", "Betting tips", "Fantasy picks",
];

function buildPrompt(
  contentType: string,
  match: string,
  teams: string,
  stage: string,
  angle: string,
  extra: string,
  platforms: string[]
): string {
  const platformList = platforms.join(", ");
  const typeLabel = CONTENT_TYPES.find((c) => c.id === contentType)?.label ?? contentType;

  const formatInstructions: Record<string, string> = {
    "youtube-script": `Write a complete YouTube script (8-12 minutes read time) with:
- HOOK (first 30 seconds — grab attention immediately)
- INTRO (brief channel intro + what they'll learn)
- BODY (3-5 main sections with clear headings)
- CTA (like, subscribe, comment prompt)
Use conversational, energetic tone. Add [B-ROLL SUGGESTION] notes throughout.`,

    "short-script": `Write a short-form video script (30-60 seconds) with:
- HOOK (first 3 seconds — must stop the scroll)
- RAPID BODY (3 punchy points, max 2 sentences each)
- CLOSE + CTA (5 seconds)
Optimised for vertical video. High energy, fast pace.`,

    "instagram-caption": `Write an Instagram caption with:
- Opening hook line (single line, no emoji yet)
- Body (3-5 short paragraphs with relevant emojis)
- Call to action (comment / share / save)
- Line break then 30 relevant hashtags grouped by size (niche + medium + broad)`,

    "twitter-thread": `Write a Twitter/X thread with:
- Tweet 1: Hook tweet that makes people want to read on (max 280 chars)
- Tweets 2-6: One insight per tweet, numbered (2/7 etc.), punchy
- Tweet 7: Summary + CTA to follow for more
Each tweet must be under 280 characters.`,

    "facebook-post": `Write a Facebook post with:
- Opening hook (2 lines)
- Story-driven body (conversational, 150-250 words)
- Question to drive comments
- 5-10 relevant hashtags`,
  };

  return `You are a social media strategist specialising in soccer/football content for short-form platforms.

TASK: Create a ${typeLabel} for platforms: ${platformList}

MATCH: ${match || "World Cup 2026 match"}
TEAMS: ${teams || "to be announced"}
STAGE: ${stage}
ANGLE / HOOK: ${angle}
${extra ? `EXTRA CONTEXT: ${extra}` : ""}

${formatInstructions[contentType] ?? "Write engaging content for the specified platform."}

Return ONLY valid JSON in this exact structure (no markdown, no code fences):
{
  "title": "catchy content title (under 60 chars)",
  "hookLine": "the single best hook sentence",
  "mainContent": "the full script/caption/thread as a single string with \\n for line breaks",
  "hashtags": ["hashtag1", "hashtag2"],
  "thumbnailIdea": "vivid description of the ideal thumbnail or cover image"
}`;
}

type GeneratedOutput = {
  title: string;
  hookLine: string;
  mainContent: string;
  hashtags: string[];
  thumbnailIdea: string;
};

export default function ContentGeneratorClient() {
  const [contentType, setContentType] = useState("youtube-script");
  const [match, setMatch] = useState("");
  const [teams, setTeams] = useState("");
  const [stage, setStage] = useState("Group Stage");
  const [angle, setAngle] = useState("Tactical breakdown");
  const [extra, setExtra] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["youtube"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [copied, setCopied] = useState("");
  const [saved, setSaved] = useState(false);

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function generate() {
    if (!match && !teams) {
      setError("Enter at least a match name or the teams.");
      return;
    }
    setError("");
    setOutput(null);
    setSaved(false);
    setLoading(true);

    const prompt = buildPrompt(contentType, match, teams, stage, angle, extra, selectedPlatforms);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const parsed: GeneratedOutput = JSON.parse(data.content);
      setOutput(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  function saveToPipeline() {
    if (!output) return;
    const pieces = getItem<ContentPiece[]>("content_pieces", []);
    const piece: ContentPiece = {
      id: makeId(),
      title: output.title,
      platforms: selectedPlatforms,
      contentType,
      topic: angle,
      teams,
      match,
      stage,
      generatedContent: output.mainContent,
      hashtags: output.hashtags,
      thumbnailIdea: output.thumbnailIdea,
      hookLine: output.hookLine,
      status: "scripted",
      scheduledDate: "",
      postedDate: "",
      views: 0,
      notes: extra,
      createdAt: new Date().toISOString(),
    };
    setItem("content_pieces", [...pieces, piece]);
    setSaved(true);
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "2rem" }}>⚽</span>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <span style={{ color: "#22c55e" }}>Faceless AI</span> · Content Generator
            </h1>
            <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              AI-powered World Cup 2026 content — scripts, captions & threads at scale
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* LEFT: Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Content type */}
          <div className="card">
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Content Type
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.id}
                  onClick={() => setContentType(ct.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.75rem",
                    padding: "0.6rem 0.875rem", borderRadius: "8px",
                    border: contentType === ct.id ? "1px solid rgba(34,197,94,0.4)" : "1px solid #222",
                    background: contentType === ct.id ? "rgba(34,197,94,0.08)" : "#1a1a1a",
                    color: contentType === ct.id ? "#22c55e" : "#aaa",
                    cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                  }}
                >
                  <span style={{ fontSize: "1.1rem", width: "1.5rem", textAlign: "center" }}>{ct.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{ct.label}</div>
                    <div style={{ fontSize: "0.7rem", color: "#555" }}>{ct.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div className="card">
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
              Target Platforms
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  style={{
                    padding: "0.35rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 600,
                    border: selectedPlatforms.includes(p.id) ? `1px solid ${p.color}` : "1px solid #2a2a2a",
                    background: selectedPlatforms.includes(p.id) ? `${p.color}22` : "transparent",
                    color: selectedPlatforms.includes(p.id) ? p.color : "#666",
                    cursor: "pointer", transition: "all 0.12s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Match details */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Match Details
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Match Name</label>
              <input className="input" value={match} onChange={(e) => setMatch(e.target.value)} placeholder="e.g. Brazil vs Argentina — Group C" />
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Teams</label>
              <input className="input" value={teams} onChange={(e) => setTeams(e.target.value)} placeholder="e.g. Brazil, Argentina" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Tournament Stage</label>
                <select className="select" style={{ width: "100%" }} value={stage} onChange={(e) => setStage(e.target.value)}>
                  {STAGES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Angle / Hook</label>
                <select className="select" style={{ width: "100%" }} value={angle} onChange={(e) => setAngle(e.target.value)}>
                  {ANGLES.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Extra Context (optional)</label>
              <textarea className="textarea" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Key stats, injuries, storylines to include..." />
            </div>
          </div>

          {error && (
            <div style={{ padding: "0.75rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", color: "#f87171", fontSize: "0.82rem" }}>
              {error}
            </div>
          )}

          <button className="btn-primary" onClick={generate} disabled={loading} style={{ fontSize: "0.95rem", padding: "0.7rem 1.5rem", opacity: loading ? 0.7 : 1 }}>
            {loading ? "⏳ Generating..." : "⚡ Generate Content"}
          </button>
        </div>

        {/* RIGHT: Output */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {!output && !loading && (
            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem", color: "#444" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚽</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#666", marginBottom: "0.5rem" }}>Ready to generate</div>
              <div style={{ fontSize: "0.8rem" }}>Fill in the match details and hit Generate</div>
            </div>
          )}

          {loading && (
            <div className="card" style={{ textAlign: "center", padding: "3rem 2rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem", animation: "spin 1s linear infinite" }}>⚽</div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#22c55e" }}>Claude is writing your content...</div>
              <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "0.4rem" }}>This takes about 10-15 seconds</div>
            </div>
          )}

          {output && (
            <>
              {/* Title & hook */}
              <div className="card" style={{ borderColor: "rgba(34,197,94,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
                      Generated Title
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.3 }}>{output.title}</div>
                  </div>
                  <button
                    onClick={() => copyText(output.title, "title")}
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#aaa", padding: "0.3rem 0.6rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", flexShrink: 0 }}
                  >
                    {copied === "title" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
                <div style={{ marginTop: "0.875rem", padding: "0.6rem 0.875rem", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.68rem", color: "#22c55e", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem" }}>Hook Line</div>
                  <div style={{ fontSize: "0.875rem", fontStyle: "italic", color: "#ddd" }}>&ldquo;{output.hookLine}&rdquo;</div>
                </div>
              </div>

              {/* Main content */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Main Content</div>
                  <button
                    onClick={() => copyText(output.mainContent, "content")}
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#aaa", padding: "0.3rem 0.6rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    {copied === "content" ? "✓ Copied" : "Copy All"}
                  </button>
                </div>
                <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: "8px", padding: "1rem", maxHeight: "320px", overflowY: "auto" }}>
                  <pre style={{ fontFamily: "inherit", fontSize: "0.82rem", lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#ddd", margin: 0 }}>
                    {output.mainContent}
                  </pre>
                </div>
              </div>

              {/* Hashtags */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Hashtags ({output.hashtags.length})
                  </div>
                  <button
                    onClick={() => copyText(output.hashtags.map((h) => `#${h}`).join(" "), "hashtags")}
                    style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#aaa", padding: "0.3rem 0.6rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem" }}
                  >
                    {copied === "hashtags" ? "✓ Copied" : "Copy"}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {output.hashtags.map((h) => (
                    <span key={h} className="badge badge-blue">#{h}</span>
                  ))}
                </div>
              </div>

              {/* Thumbnail idea */}
              <div className="card">
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
                  Thumbnail / Cover Idea
                </div>
                <div style={{ fontSize: "0.85rem", color: "#ccc", lineHeight: 1.6 }}>{output.thumbnailIdea}</div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={saveToPipeline}
                  disabled={saved}
                  className="btn-primary"
                  style={{ flex: 1, opacity: saved ? 0.6 : 1 }}
                >
                  {saved ? "✓ Saved to Pipeline" : "💾 Save to Pipeline"}
                </button>
                <button
                  onClick={generate}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                >
                  🔄 Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
