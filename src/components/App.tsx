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
import { NotificationModal } from './components/NotificationModal';
import { Transaction } from './types';
import { Wallet, LogOut, User, Settings, ChevronDown, CreditCard, Mic } from 'lucide-react';
import { FilterBar } from './components/FilterBar';
import { addWeeks, startOfToday, parseISO, isWithinInterval } from 'date-fns';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [view, setView] = useState<'dashboard' | 'transactions' | 'subscriptions' | 'voice'>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addConfirmation, setAddConfirmation] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [upcomingSubscriptions, setUpcomingSubscriptions] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkUpcomingSubscriptions();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkUpcomingSubscriptions();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchTransactions();
    }
  }, [session]);

  useEffect(() => {
    setFilteredTransactions(transactions);
  }, [transactions]);

  const checkUpcomingSubscriptions = async () => {
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('billing_date', { ascending: true });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return;
    }

    const today = startOfToday();
    const nextWeek = addWeeks(today, 1);

    const upcoming = subscriptions.filter(subscription => {
      const billingDate = parseISO(subscription.billing_date);
      return isWithinInterval(billingDate, { start: today, end: nextWeek });
    });

    if (upcoming.length > 0) {
      setUpcomingSubscriptions(upcoming);
      setShowNotifications(true);
    }
  };

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return;
    }

    setTransactions(data || []);
  }

  async function handleTransactionSubmit(data: {
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    description: string;
  }) {
    setPendingTransaction(data);
    setAddConfirmation(true);
  }

  async function handleTransactionConfirm() {
    if (!pendingTransaction) return;

    const { error } = await supabase.from('transactions').insert([{
      ...pendingTransaction,
      user_id: session.user.id
    }]);

    if (error) {
      console.error('Error adding transaction:', error);
      return;
    }

    await fetchTransactions();
    setPendingTransaction(null);
    setAddConfirmation(false);
  }

  async function handleTransactionEdit(id: string, data: Partial<Transaction>) {
    const { error } = await supabase
      .from('transactions')
      .update({
        ...data,
        user_id: session.user.id
      })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error updating transaction:', error);
      return;
    }

    await fetchTransactions();
  }

  async function handleTransactionDelete(id: string) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error deleting transaction:', error);
      return;
    }

    await fetchTransactions();
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
    setShowProfileMenu(false);
  }

  if (!session) {
    return <Auth />;
  }

  const username = session.user.user_metadata?.username || 'User';

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <Wallet className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  Expense Tracker
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setView('dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    view === 'dashboard'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setView('transactions')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    view === 'transactions'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Transactions
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowFeatures(!showFeatures)}
                    className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <span>Features</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {showFeatures && (
                    <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setView('subscriptions');
                            setShowFeatures(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Subscriptions
                        </button>
                        <button
                          onClick={() => {
                            setView('voice');
                            setShowFeatures(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <Mic className="h-4 w-4 mr-2" />
                          Voice Assistant
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <User className="h-4 w-4" />
                  <span>{username}</span>
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
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(view === 'dashboard' || view === 'transactions') && (
          <FilterBar 
            transactions={transactions} 
            onFilter={setFilteredTransactions}
          />
        )}
        
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {view === 'dashboard' && <Dashboard transactions={filteredTransactions} />}
            {view === 'transactions' && (
              <TransactionList
                transactions={filteredTransactions}
                onDelete={handleTransactionDelete}
                onEdit={handleTransactionEdit}
              />
            )}
            {view === 'subscriptions' && <SubscriptionTracker />}
            {view === 'voice' && <VoiceExpenseLogger transactions={transactions} />}
          </div>
          <div>
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

      <NotificationModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        subscriptions={upcomingSubscriptions}
        onViewAll={() => {
          setView('subscriptions');
          setShowNotifications(false);
        }}
      />
    </div>
  );
}

export default App;