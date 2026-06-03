'use client';

import { useState } from 'react';
import { Languages, Loader2, CheckCircle2, Globe2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface AIContentTranslatorProps {
  content: string;
  targetLanguages?: string[];
}

/**
 * AuthiChain Multilingual Truth Bridge
 * 
 * Uses the Protocol AI to translate product descriptions in real-time,
 * ensuring the "Truth" is accessible to global stakeholders.
 */
export default function AIContentTranslator({ content, targetLanguages = ['French', 'German', 'Spanish', 'Japanese'] }: AIContentTranslatorProps) {
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [currentLang, setCurrentLang] = useState<string | null>(null);

  const translateMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const text = typeof data.content === 'string' 
        ? data.content 
        : Array.isArray(data.content) 
          ? (data.content[0] as any).text || JSON.stringify(data.content)
          : String(data.content);
          
      setTranslatedContent(text);
      toast.success(`Translated to ${currentLang}!`);
    },
    onError: (e) => toast.error(`Translation failed: ${e.message}`)
  });

  const handleTranslate = (lang: string) => {
    setCurrentLang(lang);
    translateMutation.mutate({
      messages: [
        { role: 'user', content: `Translate the following product description into professional, elegant ${lang}. Maintain the tone of a high-end luxury brand. \n\nDescription: ${content}` }
      ]
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
         <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[8px] font-black uppercase tracking-widest text-zinc-500 mr-2">
            <Languages className="w-3 h-3" /> Truth Bridge
         </div>
         {targetLanguages.map((lang) => (
           <button 
             key={lang}
             onClick={() => handleTranslate(lang)}
             disabled={translateMutation.isPending && currentLang === lang}
             className={`
               px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter transition-all
               ${currentLang === lang && translatedContent 
                 ? 'bg-gold text-black' 
                 : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-800'
               }
             `}
           >
              {translateMutation.isPending && currentLang === lang ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : lang}
           </button>
         ))}
      </div>

      {translatedContent && (
        <div className="p-6 rounded-2xl bg-gold/5 border border-gold/10 animate-in fade-in slide-in-from-top-2 duration-500">
           <div className="flex items-center gap-2 mb-4">
              <Globe2 className="w-3.5 h-3.5 text-gold" />
              <p className="text-[9px] font-black text-gold uppercase tracking-widest">{currentLang} Edition</p>
           </div>
           <p className="text-zinc-300 text-sm leading-relaxed italic">
              "{translatedContent}"
           </p>
           <div className="mt-4 flex items-center gap-2 text-[7px] font-black text-zinc-600 uppercase tracking-widest">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              AI Verified Translation
           </div>
        </div>
      )}
    </div>
  );
}
