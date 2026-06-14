
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users,
  DollarSign,
  Copy,
  Check,
  TrendingUp,
  Clock,
  CheckCircle2,
  Share2,
} from 'lucide-react';

interface ReferralData {
  code?: string;
  referralLink?: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  referrals: Array<{
    email: string;
    tier: string;
    revenue: number;
    commission: number;
    status: string;
    date: string;
  }>;
}

export function ReferralDashboard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const response = await fetch('/api/referrals/stats');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/referrals/generate-code', {
        method: 'POST',
      });
      const result = await response.json();
      setData((prev) => ({ ...prev!, code: result.code, referralLink: result.referralLink }));
    } catch (error) {
      console.error('Failed to generate referral code:', error);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnSocial = (platform: string) => {
    const text = "Check out AuthiChain - the best NFT authentication marketplace!";
    const url = data?.referralLink || '';

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-400">Loading referral data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-red-400">Failed to load referral data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Total Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{data.totalReferrals}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Active Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{data.activeReferrals}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Pending Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">
              ${data.pendingEarnings.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400 flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Paid Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">
              ${data.paidEarnings.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Card */}
      <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Share2 className="h-5 w-5 mr-2" />
            Your Referral Link
          </CardTitle>
          <CardDescription className="text-gray-300">
            Share this link to earn 20% recurring commission on all referrals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.referralLink ? (
            <>
              <div className="flex items-center space-x-2">
                <Input
                  value={data.referralLink}
                  readOnly
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <Button
                  onClick={() => copyToClipboard(data.referralLink!)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Social Share Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => shareOnSocial('twitter')}
                >
                  Share on Twitter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => shareOnSocial('facebook')}
                >
                  Share on Facebook
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600"
                  onClick={() => shareOnSocial('linkedin')}
                >
                  Share on LinkedIn
                </Button>
              </div>
            </>
          ) : (
            <Button
              onClick={generateReferralCode}
              disabled={generating}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {generating ? 'Generating...' : 'Generate Referral Link'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          {data.referrals.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No referrals yet. Start sharing your link!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Plan</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Commission</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.referrals.map((referral, index) => (
                    <tr key={index} className="border-b border-slate-800">
                      <td className="py-3 px-4 text-gray-300">{referral.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-purple-500 text-purple-400">
                          {referral.tier}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-green-400 font-medium">
                        ${referral.commission.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            referral.status === 'PAID'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }
                        >
                          {referral.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(referral.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Info */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Commission Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Creator</div>
              <div className="text-2xl font-bold text-white">$8.70</div>
              <div className="text-xs text-gray-500">20% of $29/mo</div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Pro</div>
              <div className="text-2xl font-bold text-white">$23.70</div>
              <div className="text-xs text-gray-500">30% of $79/mo</div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Enterprise</div>
              <div className="text-2xl font-bold text-white">$89.70</div>
              <div className="text-xs text-gray-500">30% of $299/mo</div>
            </div>
            <div className="bg-white/5 p-4 rounded-lg">
              <div className="text-sm text-gray-400 mb-1">Agency</div>
              <div className="text-2xl font-bold text-white">$399.60</div>
              <div className="text-xs text-gray-500">40% of $999/mo</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
