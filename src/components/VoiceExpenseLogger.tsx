import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Calendar } from 'lucide-react';
import 'regenerator-runtime/runtime';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import nlp from 'compromise';
import { createClient } from '@supabase/supabase-js';
import { format, parse, isValid, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Transaction } from '../types';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface VoiceExpenseLoggerProps {
  transactions: Transaction[];
}

export function VoiceExpenseLogger({ transactions }: VoiceExpenseLoggerProps) {
  const [isListening, setIsListening] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const {
    transcript,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    // Send welcome message when component mounts
    setChatHistory([{
      role: 'assistant',
      content: "Hi! I'm your financial assistant. I can help you track expenses, analyze your spending, and provide budget recommendations. Try asking me things like:\n- How much did I spend this month?\n- What's my biggest expense category?\n- How can I save money?\n- What's my current balance?"
    }]);
  }, []);

  const handleStartListening = () => {
    resetTranscript();
    setIsListening(true);
    SpeechRecognition.startListening({ continuous: true });
  };

  const handleStopListening = () => {
    setIsListening(false);
    SpeechRecognition.stopListening();
  };

  const analyzeTransactions = () => {
    const currentMonth = startOfMonth(new Date());
    const lastMonth = startOfMonth(subMonths(new Date(), 1));

    const currentMonthTransactions = transactions.filter(t => 
      isValid(new Date(t.date)) && 
      new Date(t.date) >= currentMonth &&
      new Date(t.date) < endOfMonth(currentMonth)
    );

    const lastMonthTransactions = transactions.filter(t =>
      isValid(new Date(t.date)) &&
      new Date(t.date) >= lastMonth &&
      new Date(t.date) < endOfMonth(lastMonth)
    );

    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpenses;

    const categoryExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categoryExpenses)
      .sort(([, a], [, b]) => b - a);

    const currentMonthTotal = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthTotal = lastMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      balance,
      totalIncome,
      totalExpenses,
      topCategories: sortedCategories.slice(0, 3),
      currentMonthTotal,
      lastMonthTotal
    };
  };

  const generateBudgetRecommendations = (analysis: ReturnType<typeof analyzeTransactions>) => {
    const recommendations: string[] = [];

    // Basic recommendations based on 50/30/20 rule
    const monthlyIncome = analysis.totalIncome / 12;
    const necessities = monthlyIncome * 0.5;
    const wants = monthlyIncome * 0.3;
    const savings = monthlyIncome * 0.2;

    recommendations.push(
      "Based on the 50/30/20 budgeting rule, here's how you should allocate your monthly income:",
      `- Necessities (50%): $${necessities.toFixed(2)}`,
      `- Wants (30%): $${wants.toFixed(2)}`,
      `- Savings (20%): $${savings.toFixed(2)}`
    );

    // Category-specific recommendations
    if (analysis.topCategories.length > 0) {
      const [topCategory] = analysis.topCategories;
      recommendations.push(
        `\nYour highest spending category is ${topCategory[0]} at $${topCategory[1].toFixed(2)}. Consider setting a budget limit for this category.`
      );
    }

    // Month-over-month comparison
    if (analysis.currentMonthTotal > analysis.lastMonthTotal) {
      const increase = ((analysis.currentMonthTotal - analysis.lastMonthTotal) / analysis.lastMonthTotal) * 100;
      recommendations.push(
        `\nYour spending this month is ${increase.toFixed(1)}% higher than last month. Try to identify non-essential expenses you can reduce.`
      );
    }

    // Savings recommendations
    if (analysis.balance < 0) {
      recommendations.push(
        "\nYour expenses exceed your income. Here are some tips to improve your financial health:",
        "- Review and cancel unnecessary subscriptions",
        "- Look for ways to reduce daily expenses",
        "- Consider additional income sources"
      );
    }

    return recommendations.join('\n');
  };

  const processExpenseCommand = (text: string) => {
    const doc = nlp(text.toLowerCase());
    
    // Extract amount
    const amounts = doc.match('#Money').out('array');
    let amount = 0;
    if (amounts.length > 0) {
      amount = parseFloat(amounts[0].replace(/[$,]/g, ''));
    }

    // Extract type (income or expense)
    let type: 'income' | 'expense' = 'expense';
    if (text.toLowerCase().includes('earned') || 
        text.toLowerCase().includes('received') || 
        text.toLowerCase().includes('income')) {
      type = 'income';
    }

    // Extract category with more flexibility
    const expenseCategories = ['food', 'transport', 'utilities', 'entertainment', 'shopping', 'groceries', 'rent', 'bills'];
    const incomeCategories = ['salary', 'freelance', 'investment', 'bonus', 'gift'];
    const categories = type === 'income' ? incomeCategories : expenseCategories;
    
    let category = '';
    for (const cat of categories) {
      if (text.toLowerCase().includes(cat)) {
        category = cat;
        break;
      }
    }

    // Try to extract date
    let date = selectedDate;
    const dateTerms = ['yesterday', 'today', 'tomorrow'];
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    
    for (const term of dateTerms) {
      if (text.toLowerCase().includes(term)) {
        const today = new Date();
        if (term === 'yesterday') {
          today.setDate(today.getDate() - 1);
        } else if (term === 'tomorrow') {
          today.setDate(today.getDate() + 1);
        }
        date = today.toISOString().split('T')[0];
        break;
      }
    }

    // Check for specific date formats (e.g., "March 15" or "15th March")
    for (const month of monthNames) {
      if (text.toLowerCase().includes(month)) {
        const datePattern = new RegExp(`${month}\\s+(\\d{1,2})`);
        const match = text.toLowerCase().match(datePattern);
        if (match) {
          const day = parseInt(match[1]);
          const parsedDate = parse(`${month} ${day}`, 'MMMM d', new Date());
          if (isValid(parsedDate)) {
            date = parsedDate.toISOString().split('T')[0];
          }
        }
      }
    }

    // Extract description
    let description = '';
    if (doc.has('for')) {
      description = doc.splitAfter('for').eq(1).out('text').trim();
    } else if (doc.has('on')) {
      description = doc.splitAfter('on').eq(1).out('text').trim();
    }

    return { amount, type, category, date, description };
  };

  const addTransaction = async (data: {
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    description: string;
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return "You need to be logged in to add transactions.";
    }

    if (!data.amount || !data.category) {
      return "I couldn't understand the amount or category. Please try again.";
    }

    try {
      const { error } = await supabase.from('transactions').insert([{
        ...data,
        user_id: session.user.id
      }]);

      if (error) throw error;

      // Trigger a refresh of the transactions list
      const event = new CustomEvent('transaction-added');
      window.dispatchEvent(event);

      return `Added ${data.type}: $${data.amount} for ${data.category}${data.description ? ` (${data.description})` : ''} on ${format(new Date(data.date), 'MMM dd, yyyy')}`;
    } catch (error) {
      console.error('Error adding transaction:', error);
      return "Sorry, I couldn't add the transaction. Please try again.";
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage;
    setInputMessage('');
    resetTranscript();
    
    const newChatHistory = [
      ...chatHistory,
      { role: 'user', content: userMessage }
    ];
    
    setChatHistory(newChatHistory);
    setIsProcessing(true);

    try {
      let response = '';
      const lowerMessage = userMessage.toLowerCase();

      // Handle different types of queries
      if (lowerMessage.includes('help')) {
        response = `I can help you with:
- Adding transactions (e.g., "Add expense $20 for lunch")
- Checking your balance ("What's my current balance?")
- Analyzing spending ("How much did I spend this month?")
- Getting budget recommendations ("How can I save money?")
- Understanding spending patterns ("What's my biggest expense?")`;
      } else if (
        lowerMessage.includes('add') ||
        lowerMessage.includes('spent') ||
        lowerMessage.includes('received') ||
        lowerMessage.includes('earned')
      ) {
        const transactionData = processExpenseCommand(userMessage);
        response = await addTransaction(transactionData);
      } else if (lowerMessage.includes('balance')) {
        const analysis = analyzeTransactions();
        response = `Your current balance is $${analysis.balance.toFixed(2)}\n\nTotal Income: $${analysis.totalIncome.toFixed(2)}\nTotal Expenses: $${analysis.totalExpenses.toFixed(2)}`;
      } else if (lowerMessage.includes('spend') && lowerMessage.includes('month')) {
        const analysis = analyzeTransactions();
        response = `This month's spending: $${analysis.currentMonthTotal.toFixed(2)}\nLast month's spending: $${analysis.lastMonthTotal.toFixed(2)}`;
      } else if (lowerMessage.includes('biggest expense') || lowerMessage.includes('top expense')) {
        const analysis = analyzeTransactions();
        if (analysis.topCategories.length > 0) {
          response = "Your top expense categories are:\n" + 
            analysis.topCategories
              .map(([category, amount], index) => 
                `${index + 1}. ${category}: $${amount.toFixed(2)}`)
              .join('\n');
        }
      } else if (lowerMessage.includes('save') || lowerMessage.includes('budget') || lowerMessage.includes('recommendation')) {
        const analysis = analyzeTransactions();
        response = generateBudgetRecommendations(analysis);
      } else if (lowerMessage.includes('date')) {
        setShowDatePicker(true);
        response = "I've opened the date picker for you. Please select a date for your transaction.";
      } else {
        // Try to process as a transaction first
        const transactionData = processExpenseCommand(userMessage);
        if (transactionData.amount > 0 && transactionData.category) {
          response = await addTransaction(transactionData);
        } else {
          response = "I'm not sure what you're asking. Try asking about your balance, expenses, or budget recommendations. Or say 'help' to see what I can do.";
        }
      }

      setChatHistory([
        ...newChatHistory,
        { role: 'assistant', content: response }
      ]);
    } catch (error) {
      console.error('Error processing message:', error);
      setChatHistory([
        ...newChatHistory,
        { role: 'assistant', content: "I'm sorry, but I encountered an error processing your request. Please try again." }
      ]);
    }

    setIsProcessing(false);
  };

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="text-center p-4">
        Browser doesn't support speech recognition.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Assistant</h2>
      
      <div className="h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4">
          {chatHistory.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
                style={{ whiteSpace: 'pre-line' }}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3 animate-pulse">
                Processing...
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={isListening ? handleStopListening : handleStartListening}
            className={`p-2 rounded-full ${
              isListening
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            placeholder="Type or speak your message..."
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
          >
            <Calendar className="h-5 w-5" />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isProcessing}
            className="p-2 bg-blue-600 text-white rounded-full disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>

        {showDatePicker && (
          <div className="mt-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}