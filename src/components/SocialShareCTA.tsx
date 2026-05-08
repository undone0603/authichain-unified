'use client';

import { useState } from 'react';
import { Share2, Copy, CheckCircle } from 'lucide-react';

interface SocialShareCTAProps {
  imageUrl?: string;
  title?: string;
  description?: string;
}

export function SocialShareCTA({
  imageUrl: _imageUrl,
  title = 'Check out my AI QR Code!',
      description = 'Created with QRON — AI QR Code Art Generator',
}: SocialShareCTAProps) {
      
  const shareUrl = 'https://qron.space';
  const shareText = `${title}\n\n${description}\n\nCreate yours free:`;

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: description, url: shareUrl });
        trackShare('native');
      } catch {
        /* cancelled */
      }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setCopied(true);
    trackShare('copy');
    setTimeout(() => setCopied(false), 2000);
  };

  const trackShare = (method: string) => {
    fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: `share_${method}`,
        product_interest: 'qron',
        page_url: window.location.pathname,
      }),
    }).catch(() => {});
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}`;

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl">
      <span className="text-xs text-zinc-500 w-full mb-1">
        Share your creation:
      </span>

      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button onClick={handleNativeShare} className="btn-social">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      )}

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-social"
      >
        𝕏 Post
      </a>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-social"
      >
        in LinkedIn
      </a>
      <a
        href={redditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-social"
      >
        Reddit
      </a>

      <button onClick={handleCopy} className="btn-social">
        {copied ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>

      <style jsx>{`
        .btn-social {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 8px;
          color: #d4d4d8;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .btn-social:hover {
          background: #27272a;
          border-color: #3f3f46;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
