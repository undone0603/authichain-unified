import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Shield, Globe, Info, ArrowRight } from "lucide-react";

const DEMO_STEPS = [
  {
    title: "The Physical Scan",
    desc: "A consumer scans the FLUX.1 Art-Code on the product packaging.",
    image: "/assets/flux_strainchain.png", // Mapping to your provided asset
    stat: "Instant Recognition",
  },
  {
    title: "5-Agent Consensus",
    desc: "Autonomous AI agents verify the image, location data, and blockchain ledger in parallel.",
    image: null,
    icon: <Shield className="h-12 w-12 text-primary animate-pulse" />,
    stat: "99.9% Confidence",
  },
  {
    title: "Storymode Activation",
    desc: "Instead of a boring receipt, the user sees a cinematic 'Birth Story' of the product.",
    image: null,
    isStory: true,
    stat: "Consumer Engagement +400%",
  }
];

export default function StorymodeDemo() {
  const [step, setStep] = useState(0);

  return (
    <Card className="border-primary/30 bg-black/40 backdrop-blur-xl overflow-hidden">
      <CardContent className="p-0">
        <div className="grid lg:grid-cols-2">
          {/* Visual Side */}
          <div className="bg-muted/20 min-h-[300px] flex items-center justify-center relative border-r border-border/50">
            {step === 0 && (
              <img 
                src="https://98987b85-f326-4b37-896c-579591d13771.png" // The buds image you provided
                className="w-full h-full object-cover opacity-80"
                alt="StrainChain QR Art"
              />
            )}
            {step === 1 && (
              <div className="space-y-4 text-center">
                <Shield className="h-20 w-12 text-primary mx-auto animate-bounce" />
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-2 w-2 rounded-full bg-primary animate-ping" style={{ animationDelay: `${i * 0.2}s` }} />)}
                </div>
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest">Cross-Agent Verification Live</p>
              </div>
            )}
            {step === 2 && (
              <div className="p-8 text-center space-y-4">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-green-500/20 border border-primary/30 flex items-center justify-center">
                  <Play className="h-12 w-12 text-primary" />
                </div>
                <p className="text-xs italic text-muted-foreground italic">"From the volcanic soil of Maui to your hands... this is the journey of Batch #8842."</p>
              </div>
            )}
            <div className="absolute bottom-4 left-4">
              <Badge variant="outline" className="bg-black/60 text-primary border-primary/40">
                {DEMO_STEPS[step].stat}
              </Badge>
            </div>
          </div>

          {/* Logic Side */}
          <div className="p-8 flex flex-col justify-center space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Storymode Demo</p>
              <h3 className="text-2xl font-bold">{DEMO_STEPS[step].title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {DEMO_STEPS[step].desc}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {DEMO_STEPS.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${i === step ? "bg-primary w-8" : "bg-muted"}`} 
                />
              ))}
            </div>

            <Button 
              className="w-full justify-between group" 
              onClick={() => setStep((step + 1) % DEMO_STEPS.length)}
            >
              {step === 2 ? "Restart Demo" : "Next Phase"}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <div className="pt-4 flex items-start gap-3">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-tight">
                This demo utilizes the **StrainChain** industrial vertical configuration. 
                Same logic scales to Luxury, Pharma, and Government.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
