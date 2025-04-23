import React, { useState } from 'react';
import useSWR from 'swr';
import { Line } from 'react-chartjs-2';
import { format, subMonths, addMonths, differenceInMonths, isBefore } from 'date-fns';
import { TrendingUp, Search, Plus, Trash2, AlertCircle, Calendar } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface SIPInvestment {
  schemeCode: string;
  schemeName: string;
  monthlyAmount: number;
  startDate: string;
  installments: number;
  totalInvestment: number;
  units: number;
  currentValue: number;
  absoluteReturns: number;
  cagr: number;
}

interface NAVData {
  date: string;
  nav: string;
}

interface SchemeData {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
  };
  data: NAVData[];
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }
  return response.json();
};

// Helper function to find the closest NAV date
const findClosestNAVDate = (navData: NAVData[], targetDate: Date): NAVData => {
  return navData.reduce((prev, curr) => {
    const prevDate = new Date(prev.date);
    const currDate = new Date(curr.date);
    const targetTime = targetDate.getTime();
    
    return Math.abs(prevDate.getTime() - targetTime) < Math.abs(currDate.getTime() - targetTime) 
      ? prev 
      : curr;
  });
};

// Calculate CAGR (Compound Annual Growth Rate)
const calculateCAGR = (
  initialValue: number,
  finalValue: number,
  timeInYears: number
): number => {
  if (timeInYears === 0 || initialValue === 0) return 0;
  return ((Math.pow(finalValue / initialValue, 1 / timeInYears) - 1) * 100);
};

export function PortfolioTracker() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SchemeData[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<SchemeData | null>(null);
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [installments, setInstallments] = useState('12');
  const [portfolio, setPortfolio] = useState<SIPInvestment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (searchTerm.length < 3) {
      setError('Please enter at least 3 characters to search');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(searchTerm.trim())}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }

      if (data.length === 0) {
        setError('No mutual funds found matching your search');
        setSearchResults([]);
      } else {
        // Fetch detailed data for each scheme
        const detailedData = await Promise.all(
          data.slice(0, 5).map(async (scheme) => {
            const detailResponse = await fetch(`https://api.mfapi.in/mf/${scheme.schemeCode}`);
            return detailResponse.json();
          })
        );

        setSearchResults(detailedData);
        setError(null);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to fetch mutual fund data. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateSIPReturns = (scheme: SchemeData, monthlyAmount: number, startDate: Date, installments: number) => {
    const navData = scheme.data;
    let totalUnits = 0;
    let totalInvestment = 0;
    const investments: { date: Date; amount: number; units: number }[] = [];
    const today = new Date();
    
    // Calculate investments and units for each installment
    for (let i = 0; i < installments; i++) {
      const investmentDate = addMonths(startDate, i);
      if (isBefore(investmentDate, today)) {
        const navEntry = findClosestNAVDate(navData, investmentDate);
        const nav = parseFloat(navEntry.nav);
        const units = monthlyAmount / nav;
        
        totalUnits += units;
        totalInvestment += monthlyAmount;
        
        investments.push({
          date: investmentDate,
          amount: monthlyAmount,
          units: units
        });
      }
    }

    // Get current NAV
    const currentNAVEntry = findClosestNAVDate(navData, today);
    const currentNAV = parseFloat(currentNAVEntry.nav);
    const currentValue = totalUnits * currentNAV;
    
    // Calculate absolute returns
    const absoluteReturns = currentValue - totalInvestment;
    
    // Calculate time period in years for CAGR
    const timeInYears = differenceInMonths(today, startDate) / 12;
    
    // Calculate CAGR
    const cagr = calculateCAGR(totalInvestment, currentValue, timeInYears);

    return {
      totalUnits,
      totalInvestment,
      currentValue,
      absoluteReturns,
      cagr,
      investments
    };
  };

  const handleAddSIP = () => {
    if (!selectedScheme || !monthlyAmount || !startDate || !installments) {
      setError('Please fill in all fields');
      return;
    }

    const monthlyAmountNum = parseFloat(monthlyAmount);
    const installmentsNum = parseInt(installments);
    const startDateObj = new Date(startDate);

    const returns = calculateSIPReturns(selectedScheme, monthlyAmountNum, startDateObj, installmentsNum);

    const newSIP: SIPInvestment = {
      schemeCode: selectedScheme.meta.scheme_code.toString(),
      schemeName: selectedScheme.meta.scheme_name,
      monthlyAmount: monthlyAmountNum,
      startDate,
      installments: installmentsNum,
      totalInvestment: returns.totalInvestment,
      units: returns.totalUnits,
      currentValue: returns.currentValue,
      absoluteReturns: returns.absoluteReturns,
      cagr: returns.cagr
    };

    setPortfolio([...portfolio, newSIP]);
    setSelectedScheme(null);
    setMonthlyAmount('');
    setInstallments('12');
    setSearchResults([]);
    setSearchTerm('');
  };

  const handleRemoveSIP = (schemeCode: string) => {
    setPortfolio(portfolio.filter(sip => sip.schemeCode !== schemeCode));
  };

  const getPortfolioSummary = () => {
    const summary = portfolio.reduce((acc, sip) => {
      acc.totalInvestment += sip.totalInvestment;
      acc.currentValue += sip.currentValue;
      acc.absoluteReturns += sip.absoluteReturns;
      return acc;
    }, {
      totalInvestment: 0,
      currentValue: 0,
      absoluteReturns: 0
    });

    const returnsPercentage = summary.totalInvestment > 0 
      ? (summary.absoluteReturns / summary.totalInvestment) * 100 
      : 0;

    return {
      ...summary,
      returnsPercentage
    };
  };

  const performance = getPortfolioSummary();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">SIP Portfolio Tracker</h2>
        <TrendingUp className="h-6 w-6 text-blue-600" />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 rounded-md flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setError(null);
            }}
            placeholder="Search mutual funds..."
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Search className="h-5 w-5" />
            )}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
            {searchResults.map((scheme) => (
              <button
                key={scheme.meta.scheme_code}
                onClick={() => setSelectedScheme(scheme)}
                className="w-full p-2 text-left hover:bg-gray-50 border-b last:border-b-0"
              >
                <div className="font-medium">{scheme.meta.scheme_name}</div>
                <div className="text-sm text-gray-500">
                  {scheme.meta.fund_house} • {scheme.meta.scheme_category}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedScheme && (
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium mb-4">{selectedScheme.meta.scheme_name}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Monthly Investment (₹)</label>
              <input
                type="number"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter monthly amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Number of Installments</label>
              <input
                type="number"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Number of months"
              />
            </div>
          </div>
          <button
            onClick={handleAddSIP}
            className="mt-4 w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add SIP to Portfolio
          </button>
        </div>
      )}

      {portfolio.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-blue-700">Total Investment</h3>
              <p className="text-2xl font-bold text-blue-900">₹{performance.totalInvestment.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-green-700">Current Value</h3>
              <p className="text-2xl font-bold text-green-900">₹{performance.currentValue.toFixed(2)}</p>
            </div>
            <div className={`${performance.absoluteReturns >= 0 ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-md`}>
              <h3 className={`text-sm font-medium ${performance.absoluteReturns >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Total Returns
              </h3>
              <p className={`text-2xl font-bold ${performance.absoluteReturns >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                ₹{performance.absoluteReturns.toFixed(2)}
              </p>
            </div>
            <div className={`${performance.returnsPercentage >= 0 ? 'bg-green-50' : 'bg-red-50'} p-4 rounded-md`}>
              <h3 className={`text-sm font-medium ${performance.returnsPercentage >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                Returns %
              </h3>
              <p className={`text-2xl font-bold ${performance.returnsPercentage >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {performance.returnsPercentage.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-4">Your SIP Portfolio</h3>
            <div className="space-y-4">
              {portfolio.map((sip) => (
                <div key={sip.schemeCode} className="p-4 border rounded-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{sip.schemeName}</h4>
                      <p className="text-sm text-gray-500">
                        Monthly Investment: ₹{sip.monthlyAmount}
                      </p>
                      <p className="text-sm text-gray-500">
                        Start Date: {format(new Date(sip.startDate), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        Installments: {sip.installments}
                      </p>
                      <p className="text-sm text-gray-500">
                        Total Investment: ₹{sip.totalInvestment.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Current Value: ₹{sip.currentValue.toFixed(2)}
                      </p>
                      <p className={`text-sm ${sip.absoluteReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Returns: ₹{sip.absoluteReturns.toFixed(2)} ({sip.cagr.toFixed(2)}% CAGR)
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveSIP(sip.schemeCode)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedScheme && (
            <div>
              <h3 className="text-lg font-medium mb-4">NAV History</h3>
              <div className="h-64">
                <Line
                  data={{
                    labels: selectedScheme.data.slice(0, 30).map(item => format(new Date(item.date), 'MMM dd')),
                    datasets: [{
                      label: 'NAV Value',
                      data: selectedScheme.data.slice(0, 30).map(item => item.nav),
                      fill: false,
                      borderColor: 'rgb(75, 192, 192)',
                      tension: 0.1
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: false
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}