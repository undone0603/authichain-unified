/**
 * CLAUDE ARTIFACT DRAFT — NOT LIVE
 *
 * Reference copy from Claude desktop (“Cloudflare Automation Management”, 2026-09-20).
 * Do NOT import into estate /pricing, Next.js routes, workers checkout, or Stripe.
 * Paired reconciliation doc: claude-draft-pricing-artifact-2026-09-20.md
 */
import React, { useState, useEffect } from 'react';
import { Check, X, Zap, TrendingUp, Shield, Star } from 'lucide-react';

const PricingPage = () => {
  const [selectedTier, setSelectedTier] = useState('professional');
  const [isAnnual, setIsAnnual] = useState(false);
  const [currentUsage, setCurrentUsage] = useState(null);
  const [loading, setLoading] = useState(false);

  const tiers = {
    basic: {
      name: 'Basic',
      price: isAnnual ? 159 : 199,
      originalPrice: 199,
      color: 'bg-gray-500',
      features: [
        '500 Monthly Scans',
        '1 Brand Account',
        '5 Artist Profiles',
        'Basic Analytics',
        'Email Support',
        'NFT Minting',
        'QR Authentication'
      ],
      notIncluded: [
        'API Access',
        'Compliance Reports',
        'White Label',
        'Priority Support'
      ],
      limits: {
        scans: 500,

        brands: 1,
        artists: 5
      }
    },
    professional: {
      name: 'Professional',
      price: isAnnual ? 399 : 499,
      originalPrice: 499,
      color: 'bg-blue-600',
      popular: true,
      features: [
        '2,500 Monthly Scans',
        '5 Brand Accounts',
        '25 Artist Profiles',
        'Advanced Analytics',
        'Priority Support',
        'Compliance Reports',
        'API Access (50K calls)',
        'Bulk Operations',
        'Custom Integrations'
      ],
      notIncluded: [
        'White Label',
        'Dedicated Support',
        'Custom Features'
      ],
      limits: {
        scans: 2500,
        brands: 5,
        artists: 25
      }
    },

    enterprise: {
      name: 'Enterprise',
      price: isAnnual ? 799 : 999,
      originalPrice: 999,
      color: 'bg-green-600',
      features: [
        'Unlimited Scans',
        'Unlimited Brands',
        'Unlimited Artists',
        'Custom Analytics',
        'Dedicated Support',
        'White Label Options',
        'Unlimited API Access',
        'SLA Guarantee',
        'Custom Integrations',
        'Training & Onboarding',
        'Custom Reporting',
        'Priority Features'
      ],
      notIncluded: [],
      limits: {
        scans: 'unlimited',
        brands: 'unlimited',
        artists: 'unlimited'
      }
    }
  };

  useEffect(() => {
    // Fetch current usage if user is logged in
    const userId = localStorage.getItem('userId');
    if (userId) {

      fetchCurrentUsage(userId);
    }
  }, []);

  const fetchCurrentUsage = async (userId) => {
    try {
      const response = await fetch('/subscription/usage', {
        headers: { 'X-User-ID': userId }
      });
      const data = await response.json();
      setCurrentUsage(data);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  const handleUpgrade = async (tierName) => {
    setLoading(true);
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      alert('Please log in to upgrade your subscription');
      setLoading(false);
      return;
    }

    try {
      // In production, integrate with Stripe
      const response = await fetch('/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',

          'X-User-ID': userId
        },
        body: JSON.stringify({
          userId,
          tier: tierName,
          paymentToken: 'demo_token' // Replace with Stripe token
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Successfully upgraded to ${tierName} tier!`);
        window.location.href = '/dashboard';
      } else {
        alert(`Upgrade failed: ${result.error}`);
      }
    } catch (error) {
      alert('Error processing upgrade. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateSavings = (tier) => {
    const monthlyCost = tiers[tier].originalPrice;
    const annualCost = tiers[tier].price * 12;
    const regularAnnualCost = monthlyCost * 12;
    return regularAnnualCost - annualCost;
  };

  return (

    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Join 1,247+ cannabis businesses already using StrainChain
          </p>

          {/* Annual/Monthly Toggle */}
          <div className="inline-flex items-center bg-gray-800 rounded-lg p-1 mb-8">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-md transition ${
                !isAnnual ? 'bg-blue-600 text-white' : 'text-gray-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-md transition ${
                isAnnual ? 'bg-blue-600 text-white' : 'text-gray-400'
              }`}
            >
              Annual
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                Save 20%
              </span>
            </button>

          </div>
        </div>

        {/* Current Usage Alert */}
        {currentUsage && currentUsage.tier === 'free' && (
          <div className="bg-yellow-900/50 border border-yellow-500 rounded-lg p-4 mb-8 text-center">
            <p className="text-yellow-300">
              ⚠️ You've used {currentUsage.usage.scans} of 10 free scans this month.
              Upgrade now to continue scanning!
            </p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {Object.entries(tiers).map(([key, tier]) => (
            <div
              key={key}
              className={`relative bg-gray-800 rounded-2xl p-8 ${
                tier.popular ? 'ring-2 ring-blue-500 transform scale-105' : ''
              } hover:transform hover:scale-105 transition-all duration-200`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-500 to-green-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>

                <div className="mb-4">
                  <span className="text-5xl font-bold">${tier.price}</span>
                  <span className="text-gray-400 ml-2">
                    /{isAnnual ? 'month' : 'month'}
                  </span>
                </div>
                {isAnnual && (
                  <p className="text-green-400 text-sm">
                    Save ${calculateSavings(key)}/year
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
                {tier.notIncluded.map((feature, index) => (
                  <li key={index} className="flex items-start opacity-50">
                    <X className="w-5 h-5 text-gray-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-500">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleUpgrade(key)}

                disabled={loading}
                className={`w-full py-4 px-6 rounded-lg font-bold transition ${
                  tier.popular
                    ? 'bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Processing...' : 'Start Free Trial'}
              </button>

              {/* Trial info */}
              <p className="text-center text-sm text-gray-400 mt-4">
                14-day free trial • No credit card required
              </p>
            </div>
          ))}
        </div>

        {/* ROI Calculator */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-12">
          <h2 className="text-3xl font-bold mb-6 text-center">
            Calculate Your ROI
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-green-400">34%</div>
              <p className="text-gray-400 mt-2">Increase in Customer Loyalty</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-400">6 weeks</div>
              <p className="text-gray-400 mt-2">Average Payback Period</p>
            </div>

            <div>
              <div className="text-4xl font-bold text-purple-400">100%</div>
              <p className="text-gray-400 mt-2">Counterfeit Elimination</p>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-gray-300 mb-4">
              "StrainChain eliminated 100% of counterfeiting for our premium products. 
              The ROI was immediate - we paid back our investment in just 6 weeks."
            </p>
            <p className="font-bold">- Green Valley Premium</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-gray-300 mb-4">

              "As an artist, I'm now earning $2,500/month in royalties. 
              The platform transformed my cannabis packaging art into a revenue stream."
            </p>
            <p className="font-bold">- Maya Chen, Cannabis Artist</p>
          </div>
        </div>

        {/* FAQs */}
        <div className="bg-gray-800 rounded-2xl p-8">
          <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold mb-2">Can I change plans anytime?</h3>
              <p className="text-gray-400">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">What happens if I exceed my limits?</h3>
              <p className="text-gray-400">
                We'll notify you when you're approaching your limits and offer an easy upgrade path. 
                You won't lose any data or functionality.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Do you offer custom enterprise pricing?</h3>
              <p className="text-gray-400">
                Yes! For organizations with special requirements, contact us for custom pricing and features.
              </p>
            </div>
          </div>
        </div>


        {/* Contact Sales */}
        <div className="text-center mt-12">
          <p className="text-gray-400 mb-4">
            Need help choosing the right plan?
          </p>
          <button className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-8 py-3 rounded-lg font-bold hover:from-green-600 hover:to-blue-600 transition">
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
