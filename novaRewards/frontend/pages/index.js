import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useWallet } from '../context/WalletContext';
import { useRouter } from 'next/router';
import Link from 'next/link';
import WalletConnectButton from '../components/WalletConnectButton';

export default function Home() {
  const { t } = useTranslation('common');
  const { publicKey, freighterInstalled, error } = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (publicKey) {
      router.push('/dashboard');
    }
  }, [publicKey, router]);

  if (!mounted) return null;

  return (
    <>
      <nav className="nav flex items-center justify-between p-4 border-b dark:border-brand-border">
        <span className="nav-brand font-bold text-xl text-violet-600">NovaRewards</span>
        <div className="nav-links flex gap-4 items-center">
          <Link href="/merchant" className="text-sm font-medium hover:text-violet-600 transition-colors dark:text-slate-300">Merchant Portal</Link>
          <Link href="/auth/register" className="text-sm font-medium hover:text-violet-600 transition-colors dark:text-slate-300">Email Sign Up</Link>
          <Link href="/auth/login" className="text-sm font-medium hover:text-violet-600 transition-colors dark:text-slate-300">Email Login</Link>
          <WalletConnectButton />
        </div>
      </nav>

      <div className="container mx-auto px-4" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-slate-900 dark:text-white">
          {t('home.title') || 'Welcome to NovaRewards'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg mb-10 max-w-lg mx-auto">
          {t('home.description') || 'The next generation of loyalty rewards powered by Stellar.'}
        </p>

        <div className="flex flex-col items-center justify-center gap-4">
          {freighterInstalled === false ? (
            <div className="card max-w-md p-6 border rounded-xl shadow-sm bg-white dark:bg-brand-card dark:border-brand-border">
              <p className="mb-4 text-slate-600 dark:text-slate-300">
                {t('home.freighterRequired') || 'Freighter wallet is required to use NovaRewards.'}
              </p>
              <a
                href="https://www.freighter.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
              >
                {t('home.installFreighter') || 'Install Freighter'}
              </a>
            </div>
          ) : (
            <div className="scale-125">
              <WalletConnectButton />
            </div>
          )}
        </div>

        {error && <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>}
      </div>
    </>
  );
}
