'use client';

import { useWallet as useWalletFromContext } from '../context/WalletContext';

/**
 * Hook to interact with the Stellar wallet (Freighter).
 * Wraps the WalletContext to provide connect, disconnect, and sign methods.
 */
export function useWallet() {
  return useWalletFromContext();
}

export default useWallet;
