"use client";
import { useRef, useState } from "react";
import { extractTags, fileToMmdText } from "@/lib/mmd";
import type { MmdTag } from "@/lib/mmd";

type DropEntry = {
  id: string;
  name: string;
  status: "processing" | "done" | "error";
  text: string;
  tags: MmdTag[];
  error?: string;
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const ACCEPTED = [".pdf", ".doc", ".docx"];

export default function MmdDropClient() {
  const [entries, setEntries] = useState<DropEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  function isAccepted(file: File) {
    const name = file.name.toLowerCase();
    return ACCEPTED.some((ext) => name.endsWith(ext));
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter(isAccepted);
    if (files.length === 0) return;

    const pending: DropEntry[] = files.map((f) => ({
      id: makeId(),
      name: f.name,
      status: "processing",
      text: "",
      tags: [],
    }));
    setEntries((prev) => [...pending, ...prev]);

    for (let i = 0; i < files.length; i++) {
      const entryId = pending[i].id;
      try {
        const text = await fileToMmdText(files[i]);
        const tags = extractTags(text);
        setEntries((prev) =>
          prev.map((e) => (e.id === entryId ? { ...e, status: "done", text, tags } : e))
        );
      } catch (err) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, status: "error", error: err instanceof Error ? err.message : "Failed to convert file." }
              : e
          )
        );
      }
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  function onDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setIsDragging(false);
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function highlightTags(text: string) {
    const parts = text.split(/(<%[\s\S]*?%>|<<[\s\S]*?>>)/g);
    return parts.map((part, i) =>
      /^(<%[\s\S]*?%>|<<[\s\S]*?>>)$/.test(part) ? (
        <mark key={i} style={{ background: "rgba(34,197,94,0.22)", color: "#22c55e", borderRadius: "3px", padding: "0 2px" }}>
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "900px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>📥 MMD Drop Box</h1>
        <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>
          Drop a PDF or Word doc to convert it into pasteable MMD text. Tags wrapped in{" "}
          <code style={{ color: "#22c55e" }}>{"<% %>"}</code> or <code style={{ color: "#22c55e" }}>{"<< >>"}</code> are
          pulled through and detected automatically.
        </p>
      </div>

      <div
        onDrop={onDrop}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "#22c55e" : "#2a2a2a"}`,
          borderRadius: "12px",
          padding: "2.5rem 1.5rem",
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "rgba(34,197,94,0.06)" : "#111",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>{isDragging ? "📂" : "📄"}</div>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
          {isDragging ? "Drop it here" : "Drag & drop PDF or Word (.docx) files"}
        </div>
        <div style={{ color: "#666", fontSize: "0.78rem", marginTop: "0.35rem" }}>or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
        {entries.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem", color: "#555" }}>
            No documents converted yet.
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{entry.name}</div>
                {entry.status === "processing" && (
                  <span className="badge badge-blue" style={{ marginTop: "0.35rem" }}>Converting…</span>
                )}
                {entry.status === "error" && (
                  <span className="badge badge-red" style={{ marginTop: "0.35rem" }}>Failed</span>
                )}
                {entry.status === "done" && (
                  <span className="badge badge-green" style={{ marginTop: "0.35rem" }}>
                    {entry.tags.length} tag{entry.tags.length === 1 ? "" : "s"} found
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {entry.status === "done" && (
                  <button className="btn-primary" style={{ fontSize: "0.78rem", padding: "0.4rem 0.9rem" }} onClick={() => copyText(entry.id, entry.text)}>
                    {copiedId === entry.id ? "Copied!" : "Copy MMD text"}
                  </button>
                )}
                <button className="btn-ghost" style={{ fontSize: "0.78rem", padding: "0.4rem 0.9rem" }} onClick={() => removeEntry(entry.id)}>
                  Remove
                </button>
              </div>
            </div>

            {entry.status === "error" && (
              <p style={{ color: "#f87171", fontSize: "0.8rem" }}>{entry.error}</p>
            )}

            {entry.status === "done" && (
              <>
                {entry.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                    {entry.tags.map((tag) => (
                      <span key={tag.raw} className="badge badge-purple" title={tag.delimiter}>
                        {tag.name || tag.raw}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    background: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    borderRadius: "8px",
                    padding: "0.75rem",
                    maxHeight: "260px",
                    overflowY: "auto",
                    fontSize: "0.8rem",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {highlightTags(entry.text)}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
