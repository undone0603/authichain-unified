'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Filter, Search, TrendingUp, Eye, Share2, Download,
  ExternalLink, Zap, Sparkles, BarChart3, Users,
} from 'lucide-react';

const PURPLE = '#8b5cf6';
const PINK = '#ec4899';

interface QRONArt {
  id: string;
  title: string;
  artist: string;
  style: 'abstract' | 'geometric' | 'organic' | 'retro' | 'neon' | 'minimalist';
  category: 'marketing' | 'product' | 'brand' | 'social' | 'custom';
  imageUrl?: string;
  scans: number;
  shares: number;
  views: number;
  avgEngagementTime: number; // seconds
  scanLocations: string[];
  createdAt: string;
  featured: boolean;
  creator: string;
  tags: string[];
}

export default function QRONGallery() {
  const [artworks, setArtworks] = useState<QRONArt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<'all' | QRONArt['style']>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | QRONArt['category']>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'recent' | 'popular'>('trending');

  useEffect(() => {
    fetchArtworks();
    const interval = setInterval(fetchArtworks, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchArtworks = async () => {
    try {
      const res = await fetch('/api/qron/gallery');
      const data = await res.json();
      setArtworks(data.artworks || []);
    } catch (err) {
      console.error('Failed to fetch artworks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredArtworks = artworks
    .filter(art => {
      const matchesSearch = searchTerm === '' ||
        art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        art.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        art.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStyle = selectedStyle === 'all' || art.style === selectedStyle;
      const matchesCategory = selectedCategory === 'all' || art.category === selectedCategory;

      return matchesSearch && matchesStyle && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'trending') {
        const aTrend = a.scans + (a.shares * 5) + (a.views * 0.5);
        const bTrend = b.scans + (b.shares * 5) + (b.views * 0.5);
        return bTrend - aTrend;
      }
      if (sortBy === 'popular') return b.scans - a.scans;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = {
    total: artworks.length,
    totalScans: artworks.reduce((sum, a) => sum + a.scans, 0),
    totalViews: artworks.reduce((sum, a) => sum + a.views, 0),
    featured: artworks.filter(a => a.featured).length,
  };

  const styles = ['abstract', 'geometric', 'organic', 'retro', 'neon', 'minimalist'] as const;
  const categories = ['marketing', 'product', 'brand', 'social', 'custom'] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <nav className="border-b border-zinc-900 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/brand/qron" className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" style={{ color: PURPLE }} />
            <span className="font-black text-xl">QRON Gallery</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-zinc-500">Live Analytics</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: PINK }} />
              <span className="text-xs font-bold" style={{ color: PINK }}>Live</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Stats */}
        <div className="mb-12">
          <h1 className="text-5xl font-black mb-4 tracking-tighter">
            AI-Generated QR Art
          </h1>
          <p className="text-zinc-400 text-lg mb-8">
            Explore trending QRON designs, view engagement analytics, and create your own scannable art with AI.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: PURPLE }}>{stats.total}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Total Artworks</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black text-pink-400">{stats.totalScans.toLocaleString()}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Total Scans</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black text-blue-400">{stats.totalViews.toLocaleString()}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Total Views</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <div className="text-2xl font-black" style={{ color: PURPLE }}>{stats.featured}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-600 mt-1">Featured</div>
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
                placeholder="Search QRON art, artists, tags..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950 text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="trending">Sort: Trending</option>
              <option value="popular">Sort: Most Scanned</option>
              <option value="recent">Sort: Recently Created</option>
            </select>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Style:</span>
            </div>
            {(['all', ...styles] as const).map(style => (
              <button
                key={style}
                onClick={() => setSelectedStyle(style)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedStyle === style
                    ? 'bg-purple-500 text-white border border-purple-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {style === 'all' ? 'All Styles' : style}
              </button>
            ))}

            <div className="flex items-center gap-2 ml-4">
              <Sparkles className="w-4 h-4 text-zinc-600" />
              <span className="text-xs font-bold uppercase text-zinc-600">Category:</span>
            </div>
            {(['all', ...categories] as const).map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  selectedCategory === category
                    ? 'bg-purple-500 text-white border border-purple-400'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {category === 'all' ? 'All Categories' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Artworks Grid */}
        <div>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 mt-4 text-sm">Loading artworks...</p>
              </div>
            </div>
          ) : filteredArtworks.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-zinc-800 bg-zinc-950/40">
              <Sparkles className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 font-bold">No artworks match your filters</p>
              <p className="text-zinc-600 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArtworks.map(art => (
                <div
                  key={art.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden hover:border-zinc-700 transition-all group"
                >
                  {/* Placeholder for art image */}
                  <div
                    className="h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br" style={{
                      background: `linear-gradient(135deg, ${PURPLE}20 0%, ${PINK}20 100%)`
                    }} />
                    <Sparkles className="w-12 h-12 text-zinc-600" />
                    {art.featured && (
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-pink-500 text-white text-[10px] font-bold uppercase">
                        Featured
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-1 line-clamp-2">{art.title}</h3>
                    <p className="text-sm text-zinc-400 mb-3">by {art.artist}</p>

                    <div className="grid grid-cols-2 gap-2 mb-4 py-3 border-y border-zinc-800">
                      <div className="flex items-center gap-2 text-xs">
                        <Eye className="w-4 h-4" style={{ color: PURPLE }} />
                        <span className="text-zinc-400">{art.scans.toLocaleString()} scans</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <BarChart3 className="w-4 h-4" style={{ color: PINK }} />
                        <span className="text-zinc-400">{art.views.toLocaleString()} views</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Share2 className="w-4 h-4 text-blue-400" />
                        <span className="text-zinc-400">{art.shares} shares</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span className="text-zinc-400">{art.avgEngagementTime}s avg</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-2 py-1 rounded-lg bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase">
                        {art.style}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase">
                        {art.category}
                      </span>
                    </div>

                    <Link
                      href={`/brand/qron/artwork/${art.id}`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 hover:bg-purple-500/10 transition-colors text-purple-400 font-bold text-sm"
                    >
                      View & Customize <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-16 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">What is QRON?</h2>
            <p className="text-zinc-400 mb-4 leading-relaxed">
              QRON is an AI-powered QR code art studio that transforms functional QR codes into beautiful, scannable artwork. Every QRON QR code is fully functional while being visually stunning.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3 text-zinc-400">
                <Sparkles className="w-5 h-5" style={{ color: PURPLE }} />
                <span><strong>AI-Generated Design:</strong> Each QR code is unique, created by AI to match your brand</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <Sparkles className="w-5 h-5" style={{ color: PURPLE }} />
                <span><strong>100% Scannable:</strong> All QRON codes scan reliably across devices</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <Sparkles className="w-5 h-5" style={{ color: PURPLE }} />
                <span><strong>Analytics Included:</strong> Track scans, engagement, and location data</span>
              </li>
              <li className="flex items-center gap-3 text-zinc-400">
                <Sparkles className="w-5 h-5" style={{ color: PURPLE }} />
                <span><strong>White-Label Ready:</strong> Resell QRON to your customers</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8">
            <h2 className="text-2xl font-black mb-4">Monetization Models</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${PURPLE}15`, border: `1px solid ${PURPLE}30` }}>
                  <Users className="w-5 h-5" style={{ color: PURPLE }} />
                </div>
                <h3 className="font-bold mb-2">Reseller Program</h3>
                <p className="text-xs text-zinc-500">30% margin on per-scan pricing for print shops and agencies</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${PINK}15`, border: `1px solid ${PINK}30` }}>
                  <TrendingUp className="w-5 h-5" style={{ color: PINK }} />
                </div>
                <h3 className="font-bold mb-2">Scan Analytics</h3>
                <p className="text-xs text-zinc-500">$0.001-0.01 per scan for SaaS metering and analytics</p>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: '#8b5cf6' + '15', border: `1px solid #8b5cf630` }}>
                  <Zap className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                </div>
                <h3 className="font-bold mb-2">White-Label</h3>
                <p className="text-xs text-zinc-500">Custom pricing for complete platform white-label</p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-16 text-center py-10 border-t border-zinc-900">
          <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
            QRON.space · AI QR Art Studio · Last Updated: {new Date().toLocaleString()}
          </p>
        </footer>
      </div>
    </div>
  );
}
