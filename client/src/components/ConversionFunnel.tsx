
'use client';

import { Users, UserPlus, UserCheck, DollarSign } from 'lucide-react';

interface ConversionFunnelProps {
  data: {
    visitors: number;
    signups: number;
    trials: number;
    paid: number;
  };
}

export default function ConversionFunnel({ data }: ConversionFunnelProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No funnel data available
      </div>
    );
  }

  const stages = [
    {
      name: 'Visitors',
      count: data.visitors,
      icon: Users,
      color: 'blue',
      conversion: 100,
    },
    {
      name: 'Signups',
      count: data.signups,
      icon: UserPlus,
      color: 'purple',
      conversion: (data.signups / data.visitors) * 100,
    },
    {
      name: 'Trial Users',
      count: data.trials,
      icon: UserCheck,
      color: 'green',
      conversion: (data.trials / data.signups) * 100,
    },
    {
      name: 'Paid Customers',
      count: data.paid,
      icon: DollarSign,
      color: 'orange',
      conversion: (data.paid / data.trials) * 100,
    },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="space-y-6">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const maxWidth = (stage.count / data.visitors) * 100;
        
        return (
          <div key={stage.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${colorMap[stage.color]} bg-opacity-10`}>
                  <Icon className={`w-5 h-5 ${colorMap[stage.color].replace('bg-', 'text-')}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{stage.name}</p>
                  {index > 0 && (
                    <p className="text-xs text-gray-500">{stage.conversion.toFixed(1)}% conversion</p>
                  )}
                </div>
              </div>
              <p className="text-lg font-bold text-gray-900">{stage.count.toLocaleString()}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`${colorMap[stage.color]} h-3 rounded-full transition-all duration-500`}
                style={{ width: `${maxWidth}%` }}
              ></div>
            </div>
          </div>
        );
      })}

      {/* Overall Conversion */}
      <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
        <p className="text-sm font-medium text-gray-700 mb-2">Overall Conversion Rate</p>
        <p className="text-3xl font-bold text-purple-600">
          {((data.paid / data.visitors) * 100).toFixed(2)}%
        </p>
        <p className="text-xs text-gray-600 mt-1">
          From {data.visitors.toLocaleString()} visitors to {data.paid} paying customers
        </p>
      </div>
    </div>
  );
}
