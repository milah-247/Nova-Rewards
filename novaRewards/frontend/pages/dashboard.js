import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useWallet } from "../context/WalletContext";
import { useUser, useCampaigns, useBalance, useTransactions } from "../lib/useApi";
import DashboardLayout from "../components/layout/DashboardLayout";
import TrustlineButton from "../components/TrustlineButton";
import TransferForm from "../components/TransferForm";
import RedeemForm from "../components/RedeemForm";
import ReferralLink from "../components/ReferralLink";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ErrorBoundary from "../components/ErrorBoundary";
import WalletConnectButton from "../components/WalletConnectButton";
import { truncateAddress } from "../lib/truncateAddress";

// Heavy components — loaded only when the dashboard is rendered client-side
const StellarDropModal = dynamic(() => import("../components/StellarDropModal"), { ssr: false });

/**
 * Customer dashboard — balance, transaction history, trustline, transfer, redeem.
 * Requirements: 9.1, 9.2, 9.3, 8.5
 */
function DashboardContent() {
  const {
    publicKey,
    balance,
    transactions,
    refreshBalance,
    loading,
    error: walletError,
  } = useWallet();
  const router = useRouter();
  const dropModalRef = useRef(null);

  // Assume userId is stored in localStorage or from auth
  // In a real app, this might come from useAuth()
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUserId(localStorage.getItem('userId'));
    }
  }, []);

  // SWR hooks for data fetching
  const { data: user, error: userError, isLoading: userLoading } = useUser(userId);
  const { data: campaigns, error: campaignsError, isLoading: campaignsLoading } = useCampaigns();
  const { data: userBalance, error: balanceError, isLoading: balanceLoading } = useBalance(userId);
  const { data: recentTransactions, error: txError, isLoading: txLoading } = useTransactions(userId, { limit: 10 });

  useEffect(() => {
    if (!loading && !publicKey) router.push("/");
  }, [publicKey, loading, router]);

  // Check for eligible drops when dashboard loads
  useEffect(() => {
    if (publicKey && !loading) {
      // Trigger the drop modal's eligibility check
      if (dropModalRef.current) {
        dropModalRef.current.checkEligibility();
      }
    }
  }, [publicKey, loading]);

  if (!publicKey) return null;

  const shortKey = truncateAddress(publicKey);

  // Handle successful drop claim
  const handleDropClaimSuccess = (claimedAmount) => {
    // Refresh the balance to show the new tokens
    refreshBalance();
  };

  return (
    <DashboardLayout>
      <div className="dashboard-content max-w-6xl mx-auto">
        {/* Wallet status summary */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 p-6 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl text-white shadow-xl">
          <div>
            <p className="text-violet-100 text-sm font-medium mb-1">Stellar Wallet Connected</p>
            <h2 className="text-xl md:text-2xl font-bold font-mono tracking-tight">{shortKey}</h2>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
            <p className="text-violet-100 text-xs font-bold uppercase tracking-wider mb-1">Global NOVA Balance</p>
            <p className="text-3xl font-black">{parseFloat(balance).toFixed(4)} <span className="text-sm font-normal">NOVA</span></p>
          </div>
        </div>

        {userLoading || campaignsLoading || balanceLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Balance cards per campaign */}
              {userBalance && campaigns && Object.keys(userBalance).length > 0 ? (
                Object.entries(userBalance).map(([campaignId, amount]) => {
                  const campaign = campaigns.find(c => c.id === campaignId);
                  return (
                    <div key={campaignId} className="bg-white dark:bg-brand-card p-6 rounded-2xl border border-slate-200 dark:border-brand-border shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-2">
                        {campaign?.name || 'Campaign'} Balance
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white">
                          {parseFloat(amount).toFixed(2)}
                        </span>
                        <span className="text-slate-500 font-medium text-sm">{campaign?.tokenSymbol || 'NOVA'}</span>
                      </div>
                      <div className="mt-4 w-full bg-slate-100 dark:bg-brand-border rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-violet-600 h-full rounded-full"
                          style={{ width: `${Math.min((amount / (campaign?.totalSupply || 1000)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white dark:bg-brand-card p-8 rounded-2xl border border-slate-200 dark:border-brand-border shadow-sm text-center col-span-full">
                  <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">✨</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Welcome to NovaRewards!</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    You haven't earned any rewards yet. Browse merchants to start collecting points!
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Transactions and Campaigns */}
              <div className="space-y-8">
                {/* Recent transactions */}
                <div className="bg-white dark:bg-brand-card rounded-2xl border border-slate-200 dark:border-brand-border shadow-sm overflow-hidden">
                  <div className="p-6 border-b dark:border-brand-border flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h2>
                    <button className="text-sm text-violet-600 font-semibold hover:underline">View all</button>
                  </div>
                  <div className="p-0">
                    {txLoading ? (
                      <div className="p-6 space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-brand-border rounded-lg animate-pulse"></div>)}
                      </div>
                    ) : recentTransactions && recentTransactions.length > 0 ? (
                      <div className="divide-y dark:divide-brand-border">
                        {recentTransactions.map((tx, i) => (
                          <div key={tx.id || i} className="p-4 hover:bg-slate-50 dark:hover:bg-brand-border/50 transition-colors flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'transfer' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {tx.type === 'transfer' ? '⇅' : '✔'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm capitalize">{tx.type}</p>
                                <p className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-slate-900 dark:text-white text-sm">
                                {tx.amount} <span className="text-xs font-medium text-slate-500">{tx.campaign?.tokenSymbol || 'NOVA'}</span>
                              </p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${tx.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center">
                        <p className="text-slate-500 dark:text-slate-400 text-sm italic">No recent activity</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Referral Link */}
                <ReferralLink userId={publicKey} />
              </div>

              {/* Action Forms */}
              <div className="space-y-8">
                <div className="bg-white dark:bg-brand-card p-6 rounded-2xl border border-slate-200 dark:border-brand-border shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Wallet Actions</h2>
                  <div className="space-y-4">
                    <TrustlineButton
                      walletAddress={publicKey}
                      onSuccess={() => refreshBalance()}
                    />
                    <div className="p-4 bg-slate-50 dark:bg-brand-border/30 rounded-xl border border-dashed border-slate-200 dark:border-brand-border">
                      <p className="text-xs text-slate-500 mb-2 font-medium">Need to connect a different wallet?</p>
                      <WalletConnectButton />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-brand-card p-6 rounded-2xl border border-slate-200 dark:border-brand-border shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Send NOVA</h2>
                  <TransferForm
                    senderPublicKey={publicKey}
                    senderBalance={balance}
                    onSuccess={() => refreshBalance()}
                  />
                </div>

                <div className="bg-white dark:bg-brand-card p-6 rounded-2xl border border-slate-200 dark:border-brand-border shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Redeem NOVA</h2>
                  <RedeemForm
                    senderPublicKey={publicKey}
                    senderBalance={balance}
                    onSuccess={() => refreshBalance()}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Stellar Drop Modal */}
      <StellarDropModal 
        ref={dropModalRef}
        onClaimSuccess={handleDropClaimSuccess}
      />
    </DashboardLayout>
  );
}

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}

Dashboard.getLayout = function getLayout(page) {
  return <DashboardLayout>{page}</DashboardLayout>;
};
