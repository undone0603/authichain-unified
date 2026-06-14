import { useState } from 'react';
import { Share2, Copy, CheckCircle } from 'lucide-react';

interface SocialShareCTAProps {
  url?: string;
  title?: string;
  description?: string;
}

export function SocialShareCTA({
  url = 'https://authichain.com',
  title = 'Authenticate your products with AuthiChain',
  description = 'Blockchain-verified provenance for every physical product — ERC-721 + AI QR',
}: SocialShareCTAProps) {
  const [copied, setCopied] = useState(false);

  const shareText = `${title}\n\n${description}\n\nGet started:`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
        trackShare('native');
      } catch { /* cancelled */ }
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${shareText}\n${url}`);
    setCopied(true);
    trackShare('copy');
    setTimeout(() => setCopied(false), 2000);
  };

  const trackShare = (method: string) => {
    fetch('/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: `share_${method}`, product_interest: 'authichain', page_url: window.location.pathname }),
    }).catch(() => {});
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;

  const btnClass = "inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 text-xs font-semibold cursor-pointer hover:bg-zinc-800 hover:border-zinc-700 hover:text-white transition-all no-underline";

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl">
      <span className="text-xs text-zinc-500 w-full mb-1">Share:</span>

      {'share' in navigator && (
        <button onClick={handleNativeShare} className={btnClass}>
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
      )}
      <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className={btnClass}>
        𝕏 Post
      </a>
      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className={btnClass}>
        in LinkedIn
      </a>
      <a href={redditUrl} target="_blank" rel="noopener noreferrer" className={btnClass}>
        Reddit
      </a>
      <button onClick={handleCopy} className={btnClass}>
        {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}
