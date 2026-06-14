
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Users, Percent, Target, Activity } from 'lucide-react';

interface MetricsGridProps {
  metrics: any;
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  if (!metrics) {
    return <div className="text-center text-gray-400">No metrics available</div>;
  }

  const metricCards = [
    {
      title: 'Customer Lifetime Value',
      value: `$${metrics.ltv?.value || 0}`,
      icon: DollarSign,
      color: 'green',
      description: 'Average revenue per customer',
    },
    {
      title: 'Customer Acquisition Cost',
      value: `$${metrics.cac?.value || 0}`,
      icon: Target,
      color: 'blue',
      description: 'Cost to acquire new customer',
    },
    {
      title: 'Average Revenue Per User',
      value: `$${metrics.arpu?.value || 0}`,
      icon: Users,
      color: 'purple',
      description: 'ARPU across all tiers',
    },
    {
      title: 'LTV:CAC Ratio',
      value: metrics.ltvCacRatio?.value || 0,
      icon: TrendingUp,
      color: 'orange',
      description: metrics.ltvCacRatio?.target || 'Target: > 3',
    },
    {
      title: 'Net Revenue Retention',
      value: `${metrics.nrr?.value || 0}%`,
      icon: Activity,
      color: 'pink',
      description: metrics.nrr?.target || 'Target: > 100%',
    },
    {
      title: 'Growth Rate',
      value: `${metrics.growthRate?.value || 0}%`,
      icon: TrendingUp,
      color: 'indigo',
      description: 'Month-over-month growth',
    },
  ];

  const colorMap: Record<string, string> = {
    green: 'text-green-500 bg-green-50',
    blue: 'text-blue-500 bg-blue-50',
    purple: 'text-purple-500 bg-purple-50',
    orange: 'text-orange-500 bg-orange-50',
    pink: 'text-pink-500 bg-pink-50',
    indigo: 'text-indigo-500 bg-indigo-50',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        const colorClass = colorMap[metric.color];
        
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900 mb-1">{metric.value}</p>
              <p className="text-xs text-gray-500">{metric.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
