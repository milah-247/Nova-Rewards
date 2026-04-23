'use client';

import React from 'react';
import { useWallet } from '../context/WalletContext';
import { Button } from './ui/Button';
import { Loader2, Wallet, LogOut, AlertCircle } from 'lucide-react';

/**
 * WalletConnectButton component for Stellar Freighter Wallet.
 * Handles idle, connecting, connected, and error states.
 */
export default function WalletConnectButton() {
  const { 
    publicKey, 
    loading, 
    error, 
    connect, 
    disconnect, 
    hydrated 
  } = useWallet();

  if (!hydrated) {
    return <div className="h-10 w-32 bg-gray-200 animate-pulse rounded-md" />;
  }

  const shortAddress = publicKey 
    ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`
    : null;

  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-end mr-2 hidden sm:flex">
          <span className="text-xs text-slate-500 font-mono">{shortAddress}</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={disconnect}
          className="flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="w-4 h-4" />
          <span>Disconnect</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => connect('freighter')}
        disabled={loading}
        className="flex items-center gap-2 shadow-sm"
        variant="primary"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span>Connect Wallet</span>
          </>
        )}
      </Button>
      {error && (
        <div className="flex items-center gap-1 text-red-500 text-xs mt-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
