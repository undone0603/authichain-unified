import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Copy, Loader2 } from "lucide-react";

export default function ExecutiveAssistant() {
  const actions = trpc.executive.listActions.useQuery();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [inputJson, setInputJson] = useState("");
  const [output, setOutput] = useState<string | null>(null);

  const generate = trpc.executive.generate.useMutation({
    onSuccess: (data) => setOutput(data.output),
    onError: (err) => toast.error(err.message || "Generation failed"),
  });

  const selected = actions.data?.find((a) => a.key === selectedKey);

  function handleSelect(key: string) {
    setSelectedKey(key);
    setOutput(null);
    const action = actions.data?.find((a) => a.key === key);
    setInputJson(action ? JSON.stringify(action.example, null, 2) : "");
  }

  function handleGenerate() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(inputJson);
    } catch {
      toast.error("Input must be valid JSON");
      return;
    }
    generate.mutate({ action: selectedKey as any, input: parsed });
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Executive Assistant
        </h1>
        <p className="text-muted-foreground">
          AI-generated sales emails, marketing copy, and analysis — powered by the platform LLM.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Pick an action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedKey} onValueChange={handleSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Choose what to generate…" />
              </SelectTrigger>
              <SelectContent>
                {(actions.data ?? []).map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && <p className="text-sm text-muted-foreground">{selected.description}</p>}

            <div>
              <p className="text-sm font-medium mb-2">Input (JSON)</p>
              <Textarea
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                disabled={!selectedKey}
                placeholder="Select an action to load an example input"
              />
            </div>

            <Button onClick={handleGenerate} disabled={!selectedKey || generate.isPending} className="w-full">
              {generate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…
                </>
              ) : (
                "Generate"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">2. Output</CardTitle>
            {output && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {output ? (
              <pre className="whitespace-pre-wrap text-sm">{output}</pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Generated content will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
