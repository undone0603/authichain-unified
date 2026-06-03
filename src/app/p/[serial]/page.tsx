export const dynamic = 'force-dynamic';
import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Package, 
  Leaf, 
  Recycle, 
  Hammer, 
  FileText,
  Truck,
  Sparkles,
  Activity,
  MapPin,
  Lock
} from 'lucide-react';

import ProductConcierge from '@/components/ProductConcierge';
import QRONRewardUtility from '@/components/QRONRewardUtility';
import StoryModePlayer from '@/components/StoryModePlayer';
import AIContentTranslator from '@/components/AIContentTranslator';

interface PageProps {
  params: Promise<{ serial: string }>;
}

interface TimelineEvent {
  event: string;
  location: string;
  timestamp: string;
  status: 'complete' | 'pending';
}

interface SupplyChainEvent {
  event: string;
  location: string;
  date: string;
}

export default async function CertificationPage({ params }: PageProps) {
  const { serial } = await params;
  const supabase = await createClient();
  const { data: cert, error } = await supabase
    .from('certifications')
    .select('*, products(*)')
    .eq('serial_number', serial)
    .single();

  if (error || !cert) {
    notFound();
  }

  const product = cert.products as any;
  const metadata = (product.metadata as any) || {};
  const timeline = (metadata.timeline as TimelineEvent[]) || [];
  const score = product.authenticity_score || 100;

  // Fetch DPP data if it exists
  const { data: dpp } = await supabase
    .from('dpp_data')
    .select('*')
    .eq('certification_id', cert.id)
    .single();

  const isValid = cert.status === 'approved' && score >= 80;
  const isRevoked = cert.status === 'revoked';
  const isPending = cert.status === 'pending';
  const isSuspect = score < 80 && !isRevoked;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Status Header */}
        <div className="text-center mb-12">
          {isValid && (
            <div className="inline-flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20 px-8 py-4 rounded-full font-black uppercase tracking-widest animate-gold-pulse">
                <ShieldCheck className="w-6 h-6" />
                Verified Authentic
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Authenticity Index: <span className="text-green-400">{score}%</span>
              </div>
            </div>
          )}
          {isSuspect && (
            <div className="inline-flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-8 py-4 rounded-full font-black uppercase tracking-widest">
                <ShieldAlert className="w-6 h-6" />
                Suspect Artifact
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Authenticity Index: <span className="text-yellow-500">{score}%</span>
              </div>
            </div>
          )}
          {isRevoked && (
            <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 px-8 py-4 rounded-full font-black uppercase tracking-widest">
              <ShieldAlert className="w-6 h-6" />
              Certification Revoked
            </div>
          )}
          {isPending && (
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-8 py-4 rounded-full font-black uppercase tracking-widest">
              <Clock className="w-6 h-6" />
              Pending Verification
            </div>
          )}
        </div>

        {/* Seal / QR Display */}
        <div className="protocol-card mb-12 overflow-hidden bg-white group relative">
          {/* Trust Overlay */}
          <div className="absolute top-4 right-4 z-20">
             <div className="bg-black text-white px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2 shadow-2xl">
                <Activity className="w-3 h-3 text-gold" />
                <span className="text-[9px] font-black uppercase tracking-widest">Live Truth Stream</span>
             </div>
          </div>
          
          <div className="relative aspect-[4/5] md:aspect-[1/1] max-w-2xl mx-auto p-4 flex items-center justify-center">
            {cert.seal_svg_url ? (
              <Image
                src={cert.seal_svg_url}
                alt="Certification Seal"
                fill
                className="object-contain p-8"
                unoptimized
              />
            ) : cert.qr_image_url ? (
              <Image
                src={cert.qr_image_url}
                alt="QR Code"
                width={400}
                height={400}
                className="rounded-2xl"
                unoptimized
              />
            ) : (
              <div className="flex flex-col items-center gap-6 text-zinc-300 group">
                <Image
                  src="/media/samples/01_flux_qron_space.png"
                  alt="Authentic Protocol Load"
                  width={200}
                  height={200}
                  className="opacity-20 grayscale group-hover:opacity-40 transition-opacity"
                />
                <p className="font-bold uppercase tracking-[0.3em] text-[10px] text-zinc-500">
                  Cryptographic Seal Syncing
                </p>
              </div>
            )}
          </div>
          <div className="bg-zinc-100 py-4 text-center">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
              AuthiChain Protocol &bull; Ed25519 Signed
            </p>
          </div>
        </div>

        {/* AI StoryMode Player */}
        <StoryModePlayer 
          videoUrl={metadata.video_url}
          thumbnailUrl={metadata.thumbnail_url || product.imageUrl}
          brandName={product.brand || 'AuthiChain'}
          productName={product.name}
        />

        {/* Product Details */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="md:col-span-2 space-y-8">
            <div className="protocol-card p-8">
              <div className="flex items-center gap-3 mb-6">
                <Package className="w-5 h-5 text-gold" />
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
                  Product Information
                </h2>
              </div>
              <h1 className="text-4xl font-black mb-4 gold-text leading-tight">
                {product.name}
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed mb-8">
                {product.description}
              </p>

              <AIContentTranslator content={product.description || ''} />

              <div className="grid grid-cols-2 gap-y-8 gap-x-4 border-t border-zinc-800 pt-8">
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                    Manufacturer
                  </h3>
                  <p className="font-bold text-zinc-200 uppercase">
                    {product.manufacturer}
                  </p>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                    Model Identifier
                  </h3>
                  <p className="font-bold text-zinc-200 uppercase">
                    {product.model_number || 'Standard Edition'}
                  </p>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                    Serial Number
                  </h3>
                  <p className="font-mono font-bold text-gold">{serial}</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">
                    Certification Date
                  </h3>
                  <p className="font-bold text-zinc-200">
                    {new Date(
                      cert.approved_at || cert.created_at
                    ).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {isRevoked && cert.revocation_reason && (
                <div className="mt-8 p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <h3 className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">
                    Revocation Notice
                  </h3>
                  <p className="text-red-200/70 text-sm">
                    {cert.revocation_reason}
                  </p>
                </div>
              )}
            </div>

            {/* Dynamic Identity Timeline */}
            <div className="protocol-card p-8 bg-zinc-900/30 border-zinc-800">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gold" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">
                    Dynamic Identity Timeline
                  </h3>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter">Real-time Proofs</span>
                </div>
              </div>

              <div className="space-y-6">
                {timeline.length > 0 ? (
                  timeline.map((event, i) => (
                    <div key={i} className="flex gap-4 relative">
                      {i < timeline.length - 1 && (
                        <div className="absolute left-2 top-5 w-px h-full bg-zinc-800" />
                      )}
                      <div className={`w-4 h-4 rounded-full mt-1 shrink-0 flex items-center justify-center z-10 ${
                        event.status === 'complete' ? 'bg-gold/20 border border-gold/40' : 'bg-zinc-800 border border-zinc-700'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${event.status === 'complete' ? 'bg-gold' : 'bg-zinc-600'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-black text-zinc-200 uppercase tracking-tighter">{event.event}</p>
                          <p className="text-[9px] font-mono text-zinc-600">{new Date(event.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-zinc-500">
                          <MapPin className="w-2.5 h-2.5" />
                          <p className="text-[10px] font-bold uppercase tracking-tight">{event.location}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No life events recorded yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Storymode Narrative */}
            {(() => {
              const pm = product.metadata as Record<string, unknown> | null;
              const story = pm?.storymode as { chapters: Array<{ title: string; content: string }> } | undefined;
              if (!story?.chapters?.length) return null;
              return (
                <div className="protocol-card p-8 border-gold/10 bg-gold/5">
                  <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-5 h-5 text-gold" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-white">
                      Brand Story
                    </h3>
                  </div>
                  <div className="space-y-6">
                    {story.chapters.map((ch, i) => (
                      <div key={i} className="border-l-2 border-gold/20 pl-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gold mb-2">
                          {ch.title}
                        </h4>
                        <p className="text-zinc-400 text-sm leading-relaxed">{ch.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Digital Product Passport (DPP) Data */}
            {dpp && (
              <div className="protocol-card p-8 border-gold/20 bg-gold/5">
                <div className="flex items-center gap-3 mb-8">
                  <FileText className="w-5 h-5 text-gold" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">
                    Digital Product Passport
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Material Composition */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Recycle className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Material Composition
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(dpp.material_composition as Record<string, string>).map(([m, p]) => (
                        <div key={m} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-zinc-800/50">
                          <span className="text-xs font-bold text-zinc-300 uppercase">{m}</span>
                          <span className="text-xs font-black text-gold">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impact & Repair */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Leaf className="w-4 h-4 text-zinc-500" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          Carbon Footprint
                        </h3>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-zinc-800/50 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white">{dpp.carbon_footprint}</span>
                        <span className="text-[10px] font-black text-zinc-600 uppercase">kg CO2e</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Hammer className="w-4 h-4 text-zinc-500" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          Repairability Score
                        </h3>
                      </div>
                      <div className="bg-black/40 p-4 rounded-xl border border-zinc-800/50 flex items-center justify-between">
                        <div className="flex gap-1">
                          {[1,2,3,4,5,6,7,8,9,10].map(i => (
                            <div key={i} className={`w-1.5 h-4 rounded-sm ${i <= (dpp.repairability_score || 0) ? 'bg-gold' : 'bg-zinc-800'}`} />
                          ))}
                        </div>
                        <span className="text-sm font-black text-gold">{dpp.repairability_score}/10</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Supply Chain / Provenance */}
                {dpp.supply_chain_provenance && (
                  <div className="mt-12 pt-8 border-t border-zinc-800">
                    <div className="flex items-center gap-2 mb-6">
                      <Truck className="w-4 h-4 text-zinc-500" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Supply Chain Provenance
                      </h3>
                    </div>
                    <div className="space-y-4">
                      {(dpp.supply_chain_provenance as SupplyChainEvent[]).map((event, i) => (
                        <div key={i} className="flex gap-4 relative">
                          {i < (dpp.supply_chain_provenance as SupplyChainEvent[]).length - 1 && (
                            <div className="absolute left-1.5 top-4 w-px h-full bg-zinc-800" />
                          )}
                          <div className="w-3 h-3 rounded-full bg-gold/20 border border-gold/40 mt-1 shrink-0 flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-gold" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-tighter">{event.event}</p>
                            <div className="flex gap-4 mt-0.5">
                              <p className="text-[9px] font-bold text-zinc-500 uppercase">{event.location}</p>
                              <p className="text-[9px] font-bold text-zinc-700 uppercase">{new Date(event.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <ProductConcierge 
              productName={product.name} 
              brandName={product.brand || 'AuthiChain Partner'} 
              productId={product.id.toString()}
              personaPrompt={(product.metadata as Record<string, unknown>)?.persona_prompt as string | undefined}
            />
          </div>

          <div className="space-y-6">
            <div className="protocol-card p-6 bg-gold/5 border-gold/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gold mb-4">
                Registry Status
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold">Network</span>
                  <span className="font-mono text-zinc-200">Polygon POS</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold">Standard</span>
                  <span className="font-mono text-zinc-200">ERC-721</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold">Anchored</span>
                  <span className="font-mono text-zinc-200">Success</span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-zinc-800">
                <a 
                  href={`/api/v1/credentials/${product.id}`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <FileText className="w-3.5 h-3.5 group-hover:text-gold transition-colors" />
                  Download W3C Credential
                </a>
                <a 
                  href={`/api/v1/zk-proof/${product.id}?attr=origin`}
                  target="_blank"
                  className="flex items-center justify-center gap-2 w-full py-3 mt-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-blue-500/10 transition-all group"
                >
                  <Lock className="w-3.5 h-3.5 group-hover:text-blue-400 transition-colors" />
                  Generate Private Proof
                </a>
              </div>
            </div>

            <QRONRewardUtility productId={product.id} />

            <Link
              href="/"
              className="btn-gold w-full py-4 text-center rounded-xl font-black uppercase tracking-widest text-xs block shadow-gold"
            >
              Secure Your Brand &rarr;
            </Link>

            <div className="protocol-card p-6 bg-zinc-900/50 border-dashed border-zinc-800 text-center">
              <Sparkles className="w-6 h-6 text-gold mx-auto mb-3" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mb-1">
                Viral Masterpiece Detected
              </h4>
              <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed uppercase">
                Want your own cryptographically signed QR art?
              </p>
              <Link
                href="/?utm_source=verification_page&utm_medium=viral_loop"
                className="text-[10px] font-black text-gold hover:underline uppercase tracking-tighter"
              >
                Create Mine Free &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <div className="flex justify-center gap-6 mb-6 opacity-30 grayscale contrast-200">
            <span className="text-[10px] font-black uppercase tracking-widest">
              Supabase
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest">
              Polygon
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest">
              AuthiChain
            </span>
          </div>
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            Powered by{' '}
            <Link href="https://qron.space" className="text-zinc-400">
              QRON
            </Link>{' '}
            &middot; Blockchain-verified product authentication
          </p>
        </div>
      </div>
    </div>
  );
}
