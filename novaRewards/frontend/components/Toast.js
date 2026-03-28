"use client";

import { useEffect } from "react";

/**
 * Auto-dismissing toast notification.
 * @param {{ type: 'success'|'error', message: string, onClose: () => void }} props
 */
export default function Toast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const isSuccess = type === "success";

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 2000,
        background: isSuccess ? "var(--success)" : "var(--error)",
        color: "#fff",
        padding: "0.75rem 1.25rem",
        borderRadius: "10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        maxWidth: "360px",
        fontSize: "0.9rem",
        fontWeight: 500,
        animation: "slideUp 0.2s ease",
      }}
    >
      <span>{isSuccess ? "✓" : "✕"}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          fontSize: "1.1rem",
          lineHeight: 1,
          padding: 0,
          opacity: 0.8,
        }}
      >
        ×
      </button>
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(12px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
