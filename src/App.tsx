import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { Dashboard } from './components/Dashboard';
import { Auth } from './components/Auth';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { SubscriptionTracker } from './components/SubscriptionTracker';
import { VoiceExpenseLogger } from './components/VoiceExpenseLogger';
import { PortfolioTracker } from './components/PortfolioTracker';
import { Transaction } from './types';
import { Wallet, LogOut, User, Settings, ChevronDown, CreditCard, Mic, Menu } from 'lucide-react';
import { FilterBar } from './components/FilterBar';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // Changed to false to prevent URL parsing issues
      storage: {
        getItem: (key) => {
          try {
            return localStorage.getItem(key);
          } catch (error) {
            console.error('Error accessing localStorage:', error);
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            console.error('Error setting localStorage:', error);
          }
        },
        removeItem: (key) => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.error('Error removing from localStorage:', error);
          }
        }
      }
    }
  }
);

function App() {
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState<'dashboard' | 'transactions' | 'subscriptions' | 'voice' | 'portfolio'>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addConfirmation, setAddConfirmation] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        setSession(session);
      } catch (error) {
        console.error('Error getting session:', error);
        setAuthError(error.message);
        await handleSignOut();
      }
    };

    initAuth();

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setTransactions([]);
        setFilteredTransactions([]);
        clearLocalStorage();
      } else if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        setSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchTransactions();
    }
  }, [session]);

  useEffect(() => {
    setFilteredTransactions(transactions);
  }, [transactions]);

  const clearLocalStorage = () => {
    try {
      // Clear all Supabase-related items
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.expires_at');
      localStorage.removeItem('supabase.auth.refresh_token');
      // Clear any other auth-related items
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('supabase.auth.')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  const handleAuthError = async (error: any) => {
    const isAuthError = error.message?.includes('JWT') || 
                       error.message?.includes('token') ||
                       error.message?.includes('authentication');
    
    if (isAuthError) {
      console.error('Authentication error:', error);
      await handleSignOut();
      return true;
    }
    return false;
  };

  async function fetchTransactions() {
    if (!session?.user?.id) {
      console.warn('No valid session found, skipping transaction fetch');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false });

      if (error) {
        if (await handleAuthError(error)) return;
        throw error;
      }

      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
  }

  async function handleTransactionSubmit(data: {
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    description: string;
  }) {
    if (!session?.user?.id) {
      console.error('No valid session');
      return;
    }

    setPendingTransaction(data);
    setAddConfirmation(true);
  }

  async function handleTransactionConfirm() {
    if (!pendingTransaction || !session?.user?.id) return;

    try {
      const { error } = await supabase.from('transactions').insert([{
        ...pendingTransaction,
        user_id: session.user.id
      }]);

      if (error) {
        if (await handleAuthError(error)) return;
        throw error;
      }

      await fetchTransactions();
      setPendingTransaction(null);
      setAddConfirmation(false);
    } catch (error) {
      console.error('Error adding transaction:', error);
    }
  }

  async function handleTransactionEdit(id: string, data: Partial<Transaction>) {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          ...data,
          user_id: session.user.id
        })
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) {
        if (await handleAuthError(error)) return;
        throw error;
      }

      await fetchTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  }

  async function handleTransactionDelete(id: string) {
    if (!session?.user?.id) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) {
        if (await handleAuthError(error)) return;
        throw error;
      }

      await fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }

  async function handleSignOut() {
    try {
      // Clear all auth data first
      clearLocalStorage();
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Reset all state
      setSession(null);
      setTransactions([]);
      setFilteredTransactions([]);
      setShowProfileMenu(false);
      setAuthError(null);
      
    } catch (error) {
      console.error('Error signing out:', error);
      setAuthError(error.message);
      
      // Force clear session even if sign out fails
      setSession(null);
      clearLocalStorage();
    }
  }

  if (!session) {
    return <Auth error={authError} />;
  }

  const username = session.user.user_metadata?.username || 'User';

  const NavigationItems = () => (
    <>
      <button
        onClick={() => {
          setView('dashboard');
          setShowMobileMenu(false);
        }}
        className={`px-3 py-2 rounded-md text-sm font-medium ${
          view === 'dashboard'
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        Dashboard
      </button>
      <button
        onClick={() => {
          setView('transactions');
          setShowMobileMenu(false);
        }}
        className={`px-3 py-2 rounded-md text-sm font-medium ${
          view === 'transactions'
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        Transactions
      </button>
      <button
        onClick={() => {
          setView('portfolio');
          setShowMobileMenu(false);
        }}
        className={`px-3 py-2 rounded-md text-sm font-medium ${
          view === 'portfolio'
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        Portfolio
      </button>
      <button
        onClick={() => {
          setView('subscriptions');
          setShowMobileMenu(false);
        }}
        className={`px-3 py-2 rounded-md text-sm font-medium ${
          view === 'subscriptions'
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        Subscriptions
      </button>
      <button
        onClick={() => {
          setView('voice');
          setShowMobileMenu(false);
        }}
        className={`px-3 py-2 rounded-md text-sm font-medium ${
          view === 'voice'
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        Voice Assistant
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Wallet className="h-8 w-8 text-blue-600 mr-2 sm:mr-4" />
                <span className="text-xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-transparent bg-clip-text drop-shadow-lg">
                  Dhan Mantri
                </span>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:flex md:items-center md:ml-8 space-x-4">
                <NavigationItems />
              </div>
            </div>

            <div className="flex items-center">
              <div className="hidden md:flex items-center">
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:block">{username}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setSettingsOpen(true);
                            setShowProfileMenu(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile menu button */}
              <div className="flex md:hidden">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  <Menu className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          {showMobileMenu && (
            <div className="md:hidden pb-3 border-t border-gray-200">
              <div className="pt-2 space-y-1">
                <NavigationItems />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setShowMobileMenu(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </button>
                <button
                  onClick={() => {
                    handleSignOut();
                    setShowMobileMenu(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(view === 'dashboard' || view === 'transactions') && (
          <FilterBar 
            transactions={transactions} 
            onFilter={setFilteredTransactions}
          />
        )}
        
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {view === 'dashboard' && <Dashboard transactions={filteredTransactions} />}
            {view === 'transactions' && (
              <TransactionList
                transactions={filteredTransactions}
                onDelete={handleTransactionDelete}
                onEdit={handleTransactionEdit}
              />
            )}
            {view === 'portfolio' && <PortfolioTracker />}
            {view === 'subscriptions' && <SubscriptionTracker />}
            {view === 'voice' && <VoiceExpenseLogger transactions={transactions} />}
          </div>
          <div className="order-first lg:order-last">
            <TransactionForm onSubmit={handleTransactionSubmit} />
          </div>
        </div>
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentUsername={username}
      />

      <ConfirmationModal
        isOpen={addConfirmation}
        onClose={() => {
          setAddConfirmation(false);
          setPendingTransaction(null);
        }}
        onConfirm={handleTransactionConfirm}
        title="Add Transaction"
        message="Are you sure you want to add this transaction?"
        confirmText="Add"
        cancelText="Cancel"
      />
    </div>
  );
}

export default App;