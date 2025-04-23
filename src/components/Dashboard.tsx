import React, { useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { MessageCircle, X } from 'lucide-react';
import { Transaction } from '../types';
import { VoiceExpenseLogger } from './VoiceExpenseLogger';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardProps {
  transactions: Transaction[];
}

export function Dashboard({ transactions }: DashboardProps) {
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const categoryData = transactions.reduce((acc, t) => {
    if (!acc[t.category]) {
      acc[t.category] = 0;
    }
    acc[t.category] += t.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = {
    labels: Object.keys(categoryData),
    datasets: [
      {
        data: Object.values(categoryData),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ]
      }
    ]
  };

  const monthlyData = transactions.reduce((acc, t) => {
    const month = new Date(t.date).toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { income: 0, expense: 0 };
    }
    if (t.type === 'income') {
      acc[month].income += t.amount;
    } else {
      acc[month].expense += t.amount;
    }
    return acc;
  }, {} as Record<string, { income: number; expense: number }>);

  const barData = {
    labels: Object.keys(monthlyData),
    datasets: [
      {
        label: 'Income',
        data: Object.values(monthlyData).map((d) => d.income),
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1
      },
      {
        label: 'Expenses',
        data: Object.values(monthlyData).map((d) => d.expense),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="space-y-6 relative">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900">Total Income</h3>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">
            ₹{totalIncome.toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900">Total Expenses</h3>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-red-600">
            ₹{totalExpenses.toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900">Balance</h3>
          <p className={`mt-2 text-2xl sm:text-3xl font-bold ${
            balance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            ₹{balance.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Expenses by Category
          </h3>
          <div className="h-64 w-full">
            <Pie 
              data={pieData} 
              options={{ 
                maintainAspectRatio: false,
                responsive: true
              }} 
            />
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Monthly Overview
          </h3>
          <div className="h-64 w-full">
            <Bar
              data={barData}
              options={{
                maintainAspectRatio: false,
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `₹${value}`
                    }
                  }
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (context) => `₹${context.formattedValue}`
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Floating AI Assistant Button */}
      <button
        onClick={() => setShowAiAssistant(!showAiAssistant)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg transition-colors duration-200 ${
          showAiAssistant ? 'bg-red-500' : 'bg-blue-500'
        } text-white hover:opacity-90 z-50`}
      >
        {showAiAssistant ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>

      {/* AI Assistant Modal */}
      {showAiAssistant && (
        <div className="fixed bottom-24 right-6 w-full max-w-sm sm:max-w-md md:max-w-lg z-50 bg-white rounded-lg shadow-xl border border-gray-200">
          <VoiceExpenseLogger transactions={transactions} />
        </div>
      )}
    </div>
  );
}