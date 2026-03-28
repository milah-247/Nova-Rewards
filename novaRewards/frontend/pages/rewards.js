"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../components/DashboardLayout";
import ErrorBoundary from "../components/ErrorBoundary";
import RewardCard from "../components/RewardCard";
import RedeemModal from "../components/RedeemModal";
import Toast from "../components/Toast";
import PointsWidget from "../components/PointsWidget";
import { withAuth } from "../context/AuthContext";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

/**
 * Rewards catalogue page.
 * Fetches GET /api/rewards, supports category filter + cost sort,
 * and handles redemption via POST /api/redemptions.
 */
function RewardsContent() {
  const { user } = useAuth();

  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Points balance (optimistic)
  const [pointBalance, setPointBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // Filter / sort
  const [category, setCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' | 'desc'

  // Confirmation modal
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);

  // Toast
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  // ── Fetch point balance ────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!user?.wallet_address) return;
    try {
      const { data } = await api.get(
        `/api/users/${user.wallet_address}/points`,
      );
      setPointBalance(data.data.balance);
    } catch {
      // non-fatal — balance stays null
    } finally {
      setBalanceLoading(false);
    }
  }, [user?.wallet_address]);

  // ── Fetch rewards catalogue ────────────────────────────────────────────
  const fetchRewards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const { data } = await api.get(`/api/rewards?${params}`);
      setRewards(data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load rewards. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);
  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  // ── Derived: sorted rewards ────────────────────────────────────────────
  const sorted = [...rewards].sort((a, b) =>
    sortOrder === "asc" ? a.cost - b.cost : b.cost - a.cost,
  );

  // ── Unique categories for filter dropdown ─────────────────────────────
  const categories = [
    ...new Set(rewards.map((r) => r.category).filter(Boolean)),
  ];

  // ── Redeem handler ────────────────────────────────────────────────────
  async function handleConfirmRedeem() {
    if (!selectedReward || !user) return;
    setRedeeming(true);
    // Optimistic balance decrement
    const prev = pointBalance;
    setPointBalance((b) => (b !== null ? b - selectedReward.cost : b));
    setSelectedReward(null);

    try {
      await api.post(
        "/api/redemptions",
        { userId: user.id, rewardId: selectedReward.id },
        { headers: { "X-Idempotency-Key": crypto.randomUUID() } },
      );
      setToast({
        type: "success",
        message: `🎉 "${selectedReward.name}" redeemed successfully!`,
      });
      // Refresh catalogue stock counts
      fetchRewards();
      fetchBalance();
    } catch (err) {
      // Roll back optimistic update
      setPointBalance(prev);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Redemption failed. Please try again.";
      setToast({ type: "error", message: msg });
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-content" data-tour="reward-catalogue">
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>🎁 Rewards Catalogue</h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.875rem",
                marginTop: "0.25rem",
              }}
            >
              Redeem your NOVA points for prizes
            </p>
          </div>
          {/* Points balance pill */}
          <div
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: "999px",
              padding: "0.4rem 1rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              minWidth: "120px",
              textAlign: "center",
            }}
          >
            {balanceLoading ? "…" : `${pointBalance ?? 0} pts`}
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
          }}
        >
          <select
            className="input"
            style={{ width: "auto", marginBottom: 0 }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="input"
            style={{ width: "auto", marginBottom: 0 }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sort by point cost"
          >
            <option value="asc">Cost: Low → High</option>
            <option value="desc">Cost: High → Low</option>
          </select>
        </div>

        {/* States */}
        {loading && <CatalogueSkeleton />}

        {!loading && error && (
          <div
            className="card"
            style={{ textAlign: "center", borderColor: "var(--error)" }}
          >
            <p className="error" style={{ marginBottom: "1rem" }}>
              {error}
            </p>
            <button className="btn btn-primary" onClick={fetchRewards}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div
            className="card"
            style={{ textAlign: "center", padding: "3rem 1rem" }}
          >
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎁</p>
            <p style={{ color: "var(--muted)" }}>
              No rewards available right now. Check back soon!
            </p>
          </div>
        )}

        {!loading && !error && sorted.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {sorted.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userPoints={pointBalance ?? 0}
                onRedeem={() => setSelectedReward(reward)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {selectedReward && (
        <RedeemModal
          reward={selectedReward}
          userPoints={pointBalance ?? 0}
          loading={redeeming}
          onConfirm={handleConfirmRedeem}
          onCancel={() => setSelectedReward(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </DashboardLayout>
  );
}

function CatalogueSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "1.25rem",
      }}
    >
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card" style={{ padding: "1rem" }}>
          <div
            style={{
              height: "140px",
              background: "var(--surface-2)",
              borderRadius: "8px",
              marginBottom: "0.75rem",
              animation: "pulse 2s infinite",
            }}
          />
          <div
            style={{
              height: "1rem",
              background: "var(--surface-2)",
              borderRadius: "4px",
              marginBottom: "0.5rem",
              width: "70%",
              animation: "pulse 2s infinite",
            }}
          />
          <div
            style={{
              height: "0.875rem",
              background: "var(--surface-2)",
              borderRadius: "4px",
              width: "40%",
              animation: "pulse 2s infinite",
            }}
          />
        </div>
      ))}
      <style jsx>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

function Rewards() {
  return (
    <ErrorBoundary>
      <RewardsContent />
    </ErrorBoundary>
  );
}

export default withAuth(Rewards);
