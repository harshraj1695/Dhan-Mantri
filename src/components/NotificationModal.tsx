import React from 'react';
import { X, Bell } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Subscription {
  id: string;
  name: string;
  amount: number;
  billing_date: string;
  category: string;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: Subscription[];
  onViewAll: () => void;
}

export function NotificationModal({
  isOpen,
  onClose,
  subscriptions,
  onViewAll
}: NotificationModalProps) {
  if (!isOpen) return null;

  const totalAmount = subscriptions.reduce((sum, sub) => sum + sub.amount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Bell className="h-6 w-6 text-yellow-500 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Upcoming Payments</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600">
            You have {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''} due in the next week,
            totaling <span className="font-semibold">${totalAmount.toFixed(2)}</span>
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {subscriptions.map((subscription) => (
            <div
              key={subscription.id}
              className="bg-gray-50 rounded-lg p-3"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-900">{subscription.name}</h3>
                  <p className="text-sm text-gray-500">
                    Due: {format(parseISO(subscription.billing_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <span className="font-medium text-gray-900">
                  ${subscription.amount.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={onViewAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            View All Subscriptions
          </button>
        </div>
      </div>
    </div>
  );
}