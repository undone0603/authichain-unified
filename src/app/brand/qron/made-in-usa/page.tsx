'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Filter, Search, TrendingUp, MapPin, Building2, AlertCircle,
  ExternalLink, Zap, Flag, Award, BarChart3, Users,
} from 'lucide-react';

const BLUE = '#3b82f6';
const RED = '#ef4444';
const GOLD = '#fbbf24';

interface USManufacturer {
  id: string;
  companyName: string;
  productCategory: string;
  productName: string;
  state: string;
  verified: boolean;
  scans: number;
  productsTracked: number;
  qronCodeUrl: string;
  certificationDate: string;
  tags: string[];
  createdAt: string;
}

export default function MadeInUSAMarketplace() {
  const [products, setProducts] = useState<USManufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<'all' | string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'verified' | 'recent'>('trending');

  useEffect(() => {
    fetchProducts();
    const interval = setInterval(fetchProducts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/qron/made-in-usa');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products
    .filter(prod => {
      const matchesSearch = searchTerm === '' ||
        prod.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.productCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesState = selectedState === 'all' || prod.state === selectedState;
      const matchesCategory = selectedCategory === 'all' || prod.productCategory === selectedCategory;

      return matchesSearch && matchesState && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'verified') return (b.verified ? 1 : 0) - (a.verified ? 1 : 0);
      if (sortBy === 'trending') return b.scans - a.scans;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = {
    total: products.length,
    verified: products.filter(p => p.verified).length,
    totalScans: products.reduce((sum, p) => sum + p.scans, 0),
    states: new Set(products.map(p => p.state)).size,
  };

  const states = ['Texas', 'California', 'New York', 'Ohio', 'Pennsylvania', 'North Carolina'];
  const categories = ['Textiles', 'Electronics', 'Furniture', 'Automotive', 'Food & Beverage', 'Machinery'];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/brand/qron" className="flex items-center gap-3">
            <Flag className="w-6 h-6" style={{ color: RED }} />
            <span className="font-black text-xl">Made in USA</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600 border border-red-800 px-2 py-0.5 rounded">QRON</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-zinc-500">Verified Marketplace</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: RED }} />
              <span className="text-xs font-bold" style={{ color: RED }}>Live</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Stats */}
        <div className="mb-12">
          <h1 className="text-5xl font-black mb-4 tracking-tighter">
            Made in <span style={{ color: RED }}>USA</span>
          </h1>
          <p className="text-zinc-400 text-lg mb-8">
            Authentic American-made products with QRON QR code verification. Trace every product back to its US manufacturer.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: RED }}>{stats.verified}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Verified Makers</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black">{stats.total}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Products</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black text-gold-400">{stats.totalScans.toLocaleString()}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Consumer Scans</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: BLUE }}>{stats.states}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">States</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search manufacturers, products, categories..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white focus:outline-none focus:border-red-500 transition-colors"
            >
              <option value="trending">Sort: Trending</option>
              <option value="verified">Sort: Verified First</option>
              <option value="recent">Sort: Recently Added</option>
            </select>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">State:</span>
            </div>
            {(['all', ...states] as const).map(state => (
              <button
                key={state}
                onClick={() => setSelectedState(state)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedState === state
                    ? 'bg-red-500 text-white border border-red-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {state === 'all' ? 'All States' : state}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <Building2 className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Category:</span>
            </div>
            {(['all', ...categories] as const).map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedCategory === category
                    ? 'bg-red-500 text-white border border-red-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {category === 'all' ? 'All Categories' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 mt-4 text-sm">Loading products...</p>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold">No products match your filters</p>
              <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            filteredProducts.map(prod => (
              <div
                key={prod.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6 hover:border-zinc-700 transition-all hover:bg-zinc-950/60"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{prod.productName}</h3>
                      {prod.verified && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15 border border-green-500/30">
                          <Award className="w-4 h-4 text-green-400" />
                          <span className="text-[10px] font-bold text-green-400 uppercase">Verified</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-zinc-400 mb-2">{prod.companyName}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-red-500" />
                        <span>{prod.state}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-zinc-600">•</span>
                      <span className="text-sm text-zinc-400">{prod.productCategory}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-4 py-4 border-y border-zinc-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-600">Scans</span>
                    <p className="font-bold text-lg text-red-500 mt-1">{prod.scans.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-600">Products</span>
                    <p className="font-bold text-lg mt-1">{prod.productsTracked}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-zinc-600">Certified</span>
                    <p className="font-bold text-sm mt-1">{new Date(prod.certificationDate).toLocaleDateString()}</p>
                  </div>
                  <div className="hidden md:block">
                    <span className="text-[10px] font-bold uppercase text-zinc-600">Status</span>
                    <p className="text-[10px] font-bold text-green-400 mt-1">ACTIVE</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {prod.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 rounded-lg bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/brand/qron/product/${prod.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors text-red-400 font-bold text-sm"
                  >
                    View Details <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Section */}
        <div className="mt-16 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Flag className="w-6 h-6" style={{ color: RED }} />
              Why Made in USA Matters
            </h2>
            <p className="text-zinc-400 mb-4 leading-relaxed">
              The Made in USA QRON initiative connects consumers directly with American manufacturers. Every product comes with a verified QRON QR code that tells the story of its creation.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3 text-zinc-400">
                <Award className="w-5 h-5" style={{ color: GOLD }} />
                <span><strong>Verify Authenticity:</strong> Scan any product to confirm it was manufactured in the USA</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <Award className="w-5 h-5" style={{ color: GOLD }} />
                <span><strong>Support American Manufacturing:</strong> Find products made by verified US manufacturers</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <Award className="w-5 h-5" style={{ color: GOLD }} />
                <span><strong>Track Consumer Interest:</strong> Manufacturers see real-time scan and engagement data</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <Award className="w-5 h-5" style={{ color: GOLD }} />
                <span><strong>Blockchain Verification:</strong> AuthiChain NFT certificates prove manufacturing origin</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">Join the Movement</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${RED}15`, border: `1px solid ${RED}30` }}>
                  <Building2 className="w-5 h-5" style={{ color: RED }} />
                </div>
                <h3 className="font-bold mb-2">For Manufacturers</h3>
                <p className="text-xs text-zinc-500 mb-3">Get QRON codes for every product and track consumer engagement in real-time</p>
                <a href="#" className="text-xs font-bold text-red-400 hover:text-red-300">Learn more →</a>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}30` }}>
                  <Users className="w-5 h-5" style={{ color: BLUE }} />
                </div>
                <h3 className="font-bold mb-2">For Consumers</h3>
                <p className="text-xs text-zinc-500 mb-3">Scan QRON codes to verify products are truly made in the USA</p>
                <a href="#" className="text-xs font-bold text-blue-400 hover:text-blue-300">Start scanning →</a>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            Made in USA · QRON.space · Verified Marketplace
          </p>
        </footer>
      </div>
    </div>
  );
}
