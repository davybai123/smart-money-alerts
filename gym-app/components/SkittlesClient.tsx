"use client";
import { useEffect, useRef, useState } from "react";
import { getItem, setItem } from "@/lib/store";
import type { Conversation, Message } from "@/lib/store";

function makeId() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: "c1", athleteName: "James Hartley", athleteRole: "Loosehead Prop · Bath RFC",
    avatar: "JH", lastMessage: "Smashed the bench press today, PT! 160kg 🔥", lastTime: "09:14",
    unread: 2,
    messages: [
      { id: "m1", from: "pt", fromName: "Coach", content: "James, how are you feeling after yesterday's session? Any soreness?", timestamp: "08:50", read: true },
      { id: "m2", from: "athlete", fromName: "James Hartley", content: "Feeling good! Bit tight in left shoulder but nothing major.", timestamp: "08:55", read: true },
      { id: "m3", from: "pt", fromName: "Coach", content: "Good — add 10 mins shoulder mobility before today's session. I've sent a video drill.", timestamp: "09:00", read: true },
      { id: "m4", from: "athlete", fromName: "James Hartley", content: "Smashed the bench press today, PT! 160kg 🔥", timestamp: "09:14", read: false },
    ],
  },
  {
    id: "c2", athleteName: "Sienna Okafor", athleteRole: "Flanker · Leinster Women",
    avatar: "SO", lastMessage: "Can we adjust my cutting macros this week?", lastTime: "Yesterday",
    unread: 1,
    messages: [
      { id: "m5", from: "athlete", fromName: "Sienna Okafor", content: "Hi Coach! Really feeling the benefits of the new programme.", timestamp: "16:30", read: true },
      { id: "m6", from: "pt", fromName: "Coach", content: "Great to hear Sienna! Your sprint times are already showing improvement.", timestamp: "16:35", read: true },
      { id: "m7", from: "athlete", fromName: "Sienna Okafor", content: "Can we adjust my cutting macros this week?", timestamp: "17:20", read: false },
    ],
  },
  {
    id: "c3", athleteName: "Reuben Clarke", athleteRole: "Number 8 · Northampton Saints",
    avatar: "RC", lastMessage: "All good. Ready for Thursday.", lastTime: "Mon",
    unread: 0,
    messages: [
      { id: "m8", from: "pt", fromName: "Coach", content: "Reuben, match week programme is ready. Check your plan.", timestamp: "10:00", read: true },
      { id: "m9", from: "athlete", fromName: "Reuben Clarke", content: "Cheers! I'll follow it to the letter this week.", timestamp: "10:05", read: true },
      { id: "m10", from: "pt", fromName: "Coach", content: "Remember — lighter session Wednesday, full activation only.", timestamp: "10:10", read: true },
      { id: "m11", from: "athlete", fromName: "Reuben Clarke", content: "All good. Ready for Thursday.", timestamp: "10:12", read: true },
    ],
  },
];

const QUICK_REPLIES = [
  "Great work today! 💪",
  "Check your programme for tomorrow.",
  "Rest day — focus on nutrition and sleep.",
  "Match week — reduce volume, maintain intensity.",
  "PB! Keep pushing! 🏉",
  "How's recovery feeling?",
];

export default function SkittlesClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<"pt" | "athlete">("pt");
  const [showNewConv, setShowNewConv] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = getItem<Conversation[]>("skittles_conversations", []);
    if (stored.length === 0) {
      setConversations(SEED_CONVERSATIONS);
      setItem("skittles_conversations", SEED_CONVERSATIONS);
    } else {
      setConversations(stored);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeId, conversations]);

  function saveConvs(list: Conversation[]) { setConversations(list); setItem("skittles_conversations", list); }

  const active = conversations.find((c) => c.id === activeId);

  function openConversation(id: string) {
    setActiveId(id);
    saveConvs(conversations.map((c) => c.id === id ? { ...c, unread: 0, messages: c.messages.map((m) => ({ ...m, read: true })) } : c));
  }

  function sendMessage(text?: string) {
    const content = (text ?? message).trim();
    if (!content || !activeId) return;
    const newMsg: Message = {
      id: makeId(), from: role, fromName: role === "pt" ? "Coach (You)" : "Athlete (You)",
      content, timestamp: now(), read: true,
    };
    saveConvs(conversations.map((c) => c.id === activeId
      ? { ...c, messages: [...c.messages, newMsg], lastMessage: content, lastTime: now() }
      : c
    ));
    setMessage("");
  }

  function createConversation() {
    if (!newName.trim()) return;
    const conv: Conversation = {
      id: makeId(), athleteName: newName, athleteRole: newRole || "Rugby Player",
      avatar: newName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
      lastMessage: "Conversation started", lastTime: now(), unread: 0, messages: [],
    };
    const updated = [...conversations, conv];
    saveConvs(updated);
    setActiveId(conv.id);
    setShowNewConv(false);
    setNewName("");
    setNewRole("");
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div style={{ height: "calc(100vh - 0px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "1.5rem 2rem 1rem", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em" }}>🏉 Skittles 1:1</h1>
            <p style={{ color: "#666", fontSize: "0.82rem", marginTop: "0.2rem" }}>
              PT-to-Athlete coaching platform · {conversations.length} athletes
              {totalUnread > 0 && <span style={{ background: "#22c55e", color: "#000", borderRadius: "999px", padding: "0 0.5rem", marginLeft: "0.5rem", fontSize: "0.72rem", fontWeight: 700 }}>{totalUnread} new</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            {/* Role toggle */}
            <div style={{ display: "flex", background: "#1a1a1a", borderRadius: "8px", padding: "0.2rem", border: "1px solid #2a2a2a" }}>
              {(["pt", "athlete"] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)}
                  style={{
                    padding: "0.3rem 0.75rem", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600,
                    background: role === r ? "#22c55e" : "transparent",
                    color: role === r ? "#000" : "#888",
                    transition: "all 0.15s",
                  }}
                >{r === "pt" ? "PT View" : "Athlete View"}</button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => setShowNewConv(true)}>+ New Athlete</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Conversation list */}
        <div style={{ width: "300px", flexShrink: 0, borderRight: "1px solid #1a1a1a", overflowY: "auto", background: "#0d0d0d" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#555", fontSize: "0.82rem" }}>
              No athletes yet. Add one to get started.
            </div>
          ) : (
            conversations.map((c) => (
              <div key={c.id}
                onClick={() => openConversation(c.id)}
                style={{
                  padding: "0.875rem 1rem", cursor: "pointer", borderBottom: "1px solid #1a1a1a",
                  background: activeId === c.id ? "rgba(34,197,94,0.06)" : "transparent",
                  borderLeft: activeId === c.id ? "2px solid #22c55e" : "2px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                    background: activeId === c.id ? "#22c55e" : "#1e1e1e",
                    color: activeId === c.id ? "#000" : "#888",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.72rem", fontWeight: 800,
                  }}>{c.avatar}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: activeId === c.id ? "#22c55e" : "#f0f0f0" }}>{c.athleteName}</span>
                      <span style={{ fontSize: "0.65rem", color: "#555" }}>{c.lastTime}</span>
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#666", marginBottom: "0.2rem" }}>{c.athleteRole}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.72rem", color: "#555", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: "160px" }}>{c.lastMessage}</span>
                      {c.unread > 0 && (
                        <span style={{ background: "#22c55e", color: "#000", borderRadius: "999px", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800, flexShrink: 0 }}>{c.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat pane */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {active ? (
            <>
              {/* Chat header */}
              <div style={{ padding: "0.875rem 1.5rem", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: "0.875rem", flexShrink: 0 }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#22c55e", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 800 }}>{active.avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{active.athleteName}</div>
                  <div style={{ fontSize: "0.7rem", color: "#666" }}>{active.athleteRole}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <span className="badge badge-green">Active</span>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {active.messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#555", fontSize: "0.82rem", marginTop: "2rem" }}>No messages yet. Start the conversation.</div>
                )}
                {active.messages.map((msg) => {
                  const isMe = (role === "pt" && msg.from === "pt") || (role === "athlete" && msg.from === "athlete");
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ fontSize: "0.65rem", color: "#555", marginBottom: "0.2rem" }}>{msg.fromName} · {msg.timestamp}</div>
                      <div style={{
                        maxWidth: "72%", padding: "0.6rem 0.875rem", borderRadius: "12px", fontSize: "0.85rem",
                        background: isMe ? "#22c55e" : "#1a1a1a",
                        color: isMe ? "#000" : "#f0f0f0",
                        borderBottomRightRadius: isMe ? "4px" : "12px",
                        borderBottomLeftRadius: isMe ? "12px" : "4px",
                      }}>{msg.content}</div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick replies */}
              <div style={{ padding: "0.6rem 1.5rem", borderTop: "1px solid #1a1a1a", display: "flex", gap: "0.4rem", overflowX: "auto", flexShrink: 0 }}>
                {QUICK_REPLIES.map((qr) => (
                  <button key={qr} onClick={() => sendMessage(qr)}
                    style={{
                      background: "transparent", border: "1px solid #2a2a2a", borderRadius: "999px",
                      color: "#888", fontSize: "0.72rem", padding: "0.25rem 0.75rem", cursor: "pointer",
                      whiteSpace: "nowrap", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.color = "#22c55e"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#888"; }}
                  >{qr}</button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "0.875rem 1.5rem", borderTop: "1px solid #1a1a1a", display: "flex", gap: "0.75rem", flexShrink: 0 }}>
                <input
                  className="input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message ${active.athleteName}...`}
                />
                <button className="btn-primary" onClick={() => sendMessage()} style={{ whiteSpace: "nowrap" }}>Send →</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#444" }}>
              <span style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏉</span>
              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.4rem", color: "#666" }}>Skittles 1:1 Coaching</div>
              <div style={{ fontSize: "0.82rem", color: "#444", textAlign: "center", maxWidth: "300px" }}>
                Select an athlete to start messaging, or add a new athlete to your coaching roster.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New conversation modal */}
      {showNewConv && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "16px", padding: "1.5rem", width: "100%", maxWidth: "400px" }}>
            <h2 style={{ fontWeight: 800, marginBottom: "1.25rem" }}>Add Athlete to Roster</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Athlete Name *</label>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Marcus Webb" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#888", display: "block", marginBottom: "0.3rem" }}>Position / Club</label>
                <input className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="e.g. Tighthead Prop · Wasps RFC" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowNewConv(false)}>Cancel</button>
              <button className="btn-primary" onClick={createConversation}>Add Athlete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
