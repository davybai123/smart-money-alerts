"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/",            label: "Dashboard",      icon: "📊" },
  { href: "/analyzer",   label: "Analyzer",        icon: "🔬" },
  { href: "/trades",     label: "Trade Log",       icon: "📋" },
  { href: "/congress",   label: "Congress Feed",   icon: "🏛️" },
  { href: "/calculator", label: "Kelly Calc",      icon: "🧮" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile topbar */}
      <div
        className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-50"
        style={{ background: "#080808", borderBottom: "1px solid #1e1e1e" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "1.4rem" }}>💹</span>
          <span style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
            SMART<span style={{ color: "#22c55e" }}>MONEY</span>
          </span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: "none", border: "none", color: "#f0f0f0", cursor: "pointer", fontSize: "1.5rem" }}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex`}
        style={{ width: "240px", background: "#0d0d0d", borderRight: "1px solid #1a1a1a" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-start px-6 pt-8 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: "2rem" }}>💹</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.02em", lineHeight: 1 }}>
                SMART<span style={{ color: "#22c55e" }}>MONEY</span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Quant Framework
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 pb-6 flex flex-col gap-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.6rem 0.875rem",
                  borderRadius: "8px",
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: active ? "#22c55e" : "#aaa",
                  background: active ? "rgba(34,197,94,0.08)" : "transparent",
                  border: active ? "1px solid rgba(34,197,94,0.15)" : "1px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-5" style={{ borderTop: "1px solid #1a1a1a" }}>
          <div style={{ fontSize: "0.7rem", color: "#444", lineHeight: 1.5 }}>
            <div style={{ color: "#666", fontWeight: 600, marginBottom: "0.2rem" }}>
              EV · Kelly · Edge
            </div>
            Maximize long-term expected value
          </div>
        </div>
      </aside>

      {/* Desktop spacer */}
      <div className="hidden md:block" style={{ width: "240px", flexShrink: 0 }} />
    </>
  );
}
