import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { addDays, format, isWithinInterval, startOfToday, addWeeks, parseISO } from 'date-fns';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Subscription {
  id: string;
  name: string;
  amount: number;
  billing_date: string;
  category: string;
  user_id: string;
}

export function SubscriptionTracker() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubscription, setNewSubscription] = useState({
    name: '',
    amount: '',
    billing_date: '',
    category: ''
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    id: string | null;
  }>({ isOpen: false, id: null });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('billing_date', { ascending: true });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      setError('Failed to load subscriptions');
      return;
    }

    setSubscriptions(data || []);
  }

  async function handleAddSubscription(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!newSubscription.name || !newSubscription.amount || !newSubscription.billing_date || !newSubscription.category) {
      setError('Please fill in all required fields');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in to add subscriptions');
      return;
    }

    try {
      const { error: subscriptionError } = await supabase.from('subscriptions').insert([
        {
          ...newSubscription,
          amount: parseFloat(newSubscription.amount),
          user_id: session.user.id
        }
      ]);

      if (subscriptionError) throw subscriptionError;

      setShowAddForm(false);
      setNewSubscription({ name: '', amount: '', billing_date: '', category: '' });
      fetchSubscriptions();
    } catch (error) {
      console.error('Error adding subscription:', error);
      setError('Failed to add subscription');
    }
  }

  async function handleDeleteSubscription(id: string) {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting subscription:', error);
      setError('Failed to delete subscription');
      return;
    }

    fetchSubscriptions();
    setDeleteConfirmation({ isOpen: false, id: null });
  }

  async function handleMarkAsPaid(subscription: Subscription) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in to mark subscriptions as paid');
      return;
    }

    try {
      // Add the payment as a transaction
      const { error: transactionError } = await supabase.from('transactions').insert([
        {
          amount: subscription.amount,
          type: 'expense',
          category: subscription.category,
          description: `Subscription payment for ${subscription.name}`,
          date: new Date().toISOString().split('T')[0],
          user_id: session.user.id
        }
      ]);

      if (transactionError) throw transactionError;

      // Update the subscription's next billing date
      const nextBillingDate = addDays(parseISO(subscription.billing_date), 30);
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ billing_date: format(nextBillingDate, 'yyyy-MM-dd') })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      // Trigger a refresh of the transactions list
      const event = new CustomEvent('transaction-added');
      window.dispatchEvent(event);

      fetchSubscriptions();
    } catch (error) {
      console.error('Error marking subscription as paid:', error);
      setError('Failed to mark subscription as paid');
    }
  }

  const getDueSoonSubscriptions = () => {
    const today = startOfToday();
    const nextWeek = addWeeks(today, 1);

    return subscriptions.filter(subscription => {
      const billingDate = parseISO(subscription.billing_date);
      return isWithinInterval(billingDate, { start: today, end: nextWeek });
    });
  };

  const dueSoonSubscriptions = getDueSoonSubscriptions();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Subscriptions</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Subscription
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {dueSoonSubscriptions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Due Soon</h3>
          <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
            {dueSoonSubscriptions.map((subscription) => (
              <div
                key={`due-${subscription.id}`}
                className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm"
              >
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                  <div>
                    <p className="font-medium text-gray-900">{subscription.name}</p>
                    <p className="text-sm text-gray-500">
                      Due: {format(parseISO(subscription.billing_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-medium text-gray-900">
                    ${subscription.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleMarkAsPaid(subscription)}
                    className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark as Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddSubscription} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newSubscription.name}
                onChange={(e) => setNewSubscription({ ...newSubscription, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                value={newSubscription.amount}
                onChange={(e) => setNewSubscription({ ...newSubscription, amount: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Billing Date</label>
              <input
                type="date"
                value={newSubscription.billing_date}
                onChange={(e) => setNewSubscription({ ...newSubscription, billing_date: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={newSubscription.category}
                onChange={(e) => setNewSubscription({ ...newSubscription, category: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Select category</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Software">Software</option>
                <option value="Music">Music</option>
                <option value="Streaming">Streaming</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {subscriptions
          .filter(sub => !dueSoonSubscriptions.includes(sub))
          .map((subscription) => (
          <div
            key={subscription.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
          >
            <div>
              <h3 className="font-medium text-gray-900">{subscription.name}</h3>
              <p className="text-sm text-gray-500">
                {subscription.category} • Next billing: {format(parseISO(subscription.billing_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="font-medium text-gray-900">
                ${subscription.amount.toFixed(2)}/mo
              </span>
              <button 
                onClick={() => setDeleteConfirmation({ isOpen: true, id: subscription.id })}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, id: null })}
        onConfirm={() => {
          if (deleteConfirmation.id) {
            handleDeleteSubscription(deleteConfirmation.id);
          }
        }}
        title="Delete Subscription"
        message="Are you sure you want to delete this subscription? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}