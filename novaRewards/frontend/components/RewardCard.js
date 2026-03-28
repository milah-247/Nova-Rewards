"use client";

/**
 * Displays a single reward item in the catalogue grid.
 * Disables the redeem button when the user can't afford it or it's out of stock.
 */
export default function RewardCard({ reward, userPoints, onRedeem }) {
  const outOfStock = reward.stock !== null && reward.stock <= 0;
  const cannotAfford = userPoints < reward.cost;
  const disabled = outOfStock || cannotAfford;

  let disabledReason = "";
  if (outOfStock) disabledReason = "Out of stock";
  else if (cannotAfford)
    disabledReason = `Need ${reward.cost - userPoints} more pts`;

  return (
    <div
      className="card"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        opacity: outOfStock ? 0.6 : 1,
        transition: "transform 0.15s",
      }}
    >
      {/* Image */}
      <div
        style={{
          height: "140px",
          borderRadius: "8px",
          overflow: "hidden",
          background: "var(--surface-2)",
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "3rem",
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

      {/* Name */}
      <p
        style={{
          fontWeight: 700,
          marginBottom: "0.25rem",
          fontSize: "0.95rem",
        }}
      >
        {reward.name}
      </p>

      {/* Category badge */}
      {reward.category && (
        <span
          className="badge badge-gray"
          style={{ marginBottom: "0.5rem", alignSelf: "flex-start" }}
        >
          {reward.category}
        </span>
      )}

      {/* Cost + stock row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
          marginTop: "auto",
        }}
      >
        <span
          style={{ fontWeight: 700, color: "var(--accent)", fontSize: "1rem" }}
        >
          {reward.cost} pts
        </span>
        <span className={`badge ${outOfStock ? "badge-gray" : "badge-green"}`}>
          {outOfStock
            ? "Out of stock"
            : reward.stock === null
              ? "In stock"
              : `${reward.stock} left`}
        </span>
      </div>

      {/* Redeem button */}
      <button
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={disabled}
        onClick={onRedeem}
        aria-label={
          disabled
            ? `Cannot redeem ${reward.name}: ${disabledReason}`
            : `Redeem ${reward.name} for ${reward.cost} points`
        }
        title={disabled ? disabledReason : undefined}
      >
        {disabled ? disabledReason : "Redeem"}
      </button>
    </div>
  );
}
