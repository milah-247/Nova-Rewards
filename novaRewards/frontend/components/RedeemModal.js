"use client";

/**
 * Confirmation modal shown before a redemption is submitted.
 * Shows item details, point cost, and remaining balance after redemption.
 */
export default function RedeemModal({
  reward,
  userPoints,
  loading,
  onConfirm,
  onCancel,
}) {
  const balanceAfter = userPoints - reward.cost;

  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="redeem-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 id="redeem-modal-title" style={{ marginBottom: "1rem" }}>
          Confirm Redemption
        </h3>

        {/* Item details */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "flex-start",
            marginBottom: "1.25rem",
            padding: "1rem",
            background: "var(--surface-2)",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "8px",
              background: "var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {reward.image_url ? (
              <img
                src={reward.image_url}
                alt={reward.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              "🎁"
            )}
          </div>
          <div>
            <p style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              {reward.name}
            </p>
            {reward.category && (
              <span
                className="badge badge-gray"
                style={{ marginBottom: "0.5rem" }}
              >
                {reward.category}
              </span>
            )}
          </div>
        </div>

        {/* Points breakdown */}
        <div className="confirmation-details">
          <p style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>Cost</span>
            <span style={{ fontWeight: 700, color: "var(--accent)" }}>
              −{reward.cost} pts
            </span>
          </p>
          <p
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "0.5rem",
            }}
          >
            <span style={{ color: "var(--muted)" }}>Your balance</span>
            <span>{userPoints} pts</span>
          </p>
          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--border)",
              margin: "0.75rem 0",
            }}
          />
          <p style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--muted)" }}>Balance after</span>
            <span style={{ fontWeight: 700 }}>{balanceAfter} pts</span>
          </p>
        </div>

        <div className="modal-actions">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="btn-loading">
                <span className="spinner" />
                Redeeming…
              </span>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
