import React, { useState, useEffect } from 'react';
import { Transaction } from '../types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';

interface FilterBarProps {
  transactions: Transaction[];
  onFilter: (filtered: Transaction[]) => void;
}

export function FilterBar({ transactions, onFilter }: FilterBarProps) {
  const [filterType, setFilterType] = useState<'all' | 'week' | 'month'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    filterTransactions();
  }, [filterType, selectedMonth, selectedYear, transactions]);

  const filterTransactions = () => {
    if (filterType === 'all') {
      onFilter(transactions);
      return;
    }

    const filtered = transactions.filter(transaction => {
      const date = parseISO(transaction.date);
      
      if (filterType === 'week') {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 });
        const end = endOfWeek(new Date(), { weekStartsOn: 1 });
        return isWithinInterval(date, { start, end });
      }

      if (filterType === 'month') {
        const start = startOfMonth(new Date(selectedYear, selectedMonth));
        const end = endOfMonth(new Date(selectedYear, selectedMonth));
        return isWithinInterval(date, { start, end });
      }

      return true;
    });

    onFilter(filtered);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Filter by:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'week' | 'month')}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="week">This Week</option>
            <option value="month">By Month</option>
          </select>
        </div>

        {filterType === 'month' && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {months.map((month, index) => (
                  <option key={month} value={index}>{month}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}