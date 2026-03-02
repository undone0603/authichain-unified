import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gem, Loader2, Plus, Gavel, Clock, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function NftMarketplace() {
  const { data: nfts, isLoading } = trpc.nft.list.useQuery({ limit: 50 });
  const { data: myNfts } = trpc.nft.list.useQuery({ limit: 50 });
  const { data: collections } = trpc.nft.collections.list.useQuery();
  const { data: auctions } = trpc.nft.auctions.list.useQuery();
  const mintNft = trpc.nft.create.useMutation();
  const createCollection = trpc.nft.collections.create.useMutation();
  const placeBid = trpc.nft.auctions.bid.useMutation();
  const utils = trpc.useUtils();

  const [mintOpen, setMintOpen] = useState(false);
  const [collOpen, setCollOpen] = useState(false);
  const [mintForm, setMintForm] = useState({ name: "", description: "", imageUrl: "", collectionId: "" });
  const [collForm, setCollForm] = useState({ name: "", description: "" });
  const [bidAmounts, setBidAmounts] = useState<Record<number, string>>({});

  const handleMint = async () => {
    if (!mintForm.name) { toast.error("Name is required"); return; }
    try {
      await mintNft.mutateAsync({
        name: mintForm.name,
        description: mintForm.description || undefined,
        imageUrl: mintForm.imageUrl || undefined,
      });
      toast.success("NFT minted successfully");
      setMintOpen(false);
      setMintForm({ name: "", description: "", imageUrl: "", collectionId: "" });
      utils.nft.list.invalidate();
      utils.nft.list.invalidate();
    } catch (e: any) { toast.error(e.message || "Mint failed"); }
  };

  const handleCreateCollection = async () => {
    if (!collForm.name) { toast.error("Name is required"); return; }
    try {
      await createCollection.mutateAsync({ name: collForm.name, slug: collForm.name.toLowerCase().replace(/\s+/g, '-'), description: collForm.description || undefined });
      toast.success("Collection created");
      setCollOpen(false);
      setCollForm({ name: "", description: "" });
      utils.nft.collections.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleBid = async (auctionId: number) => {
    const amount = parseFloat(bidAmounts[auctionId] || "0");
    if (!amount) { toast.error("Enter a bid amount"); return; }
    try {
      await placeBid.mutateAsync({ auctionId, amount: amount.toString() });
      toast.success("Bid placed");
      setBidAmounts((prev) => ({ ...prev, [auctionId]: "" }));
      utils.nft.auctions.list.invalidate();
    } catch (e: any) { toast.error(e.message || "Bid failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">NFT Marketplace</h1>
          <p className="text-muted-foreground text-sm mt-1">Mint, collect, and trade authentication NFTs</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={collOpen} onOpenChange={setCollOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="bg-transparent"><Plus className="mr-1 h-4 w-4" /> Collection</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Collection</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={collForm.name} onChange={(e) => setCollForm({ ...collForm, name: e.target.value })} className="mt-1" /></div>
                <div><Label>Description</Label><Input value={collForm.description} onChange={(e) => setCollForm({ ...collForm, description: e.target.value })} className="mt-1" /></div>
                <Button className="w-full" onClick={handleCreateCollection} disabled={createCollection.isPending}>
                  {createCollection.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={mintOpen} onOpenChange={setMintOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Mint NFT</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Mint New NFT</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={mintForm.name} onChange={(e) => setMintForm({ ...mintForm, name: e.target.value })} className="mt-1" /></div>
                <div><Label>Description</Label><Input value={mintForm.description} onChange={(e) => setMintForm({ ...mintForm, description: e.target.value })} className="mt-1" /></div>
                <div><Label>Image URL</Label><Input value={mintForm.imageUrl} onChange={(e) => setMintForm({ ...mintForm, imageUrl: e.target.value })} className="mt-1" /></div>
                {collections && collections.length > 0 && (
                  <div>
                    <Label>Collection (optional)</Label>
                    <Select value={mintForm.collectionId} onValueChange={(v) => setMintForm({ ...mintForm, collectionId: v })}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select collection" /></SelectTrigger>
                      <SelectContent>
                        {collections.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button className="w-full" onClick={handleMint} disabled={mintNft.isPending}>
                  {mintNft.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gem className="mr-2 h-4 w-4" />} Mint NFT
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="my-nfts">My NFTs ({myNfts?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="auctions">Auctions ({auctions?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="collections">Collections ({collections?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : nfts && nfts.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {nfts.map((nft: any) => <NftCard key={nft.id} nft={nft} />)}
            </div>
          ) : (
            <EmptyState icon={Gem} title="No NFTs Yet" desc="Mint your first NFT to get started" />
          )}
        </TabsContent>

        <TabsContent value="my-nfts" className="mt-4">
          {myNfts && myNfts.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myNfts.map((nft: any) => <NftCard key={nft.id} nft={nft} />)}
            </div>
          ) : (
            <EmptyState icon={Gem} title="No NFTs Owned" desc="Mint or purchase NFTs to see them here" />
          )}
        </TabsContent>

        <TabsContent value="auctions" className="mt-4">
          {auctions && auctions.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {auctions.map((a: any) => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">Auction #{a.id}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Ends: {new Date(a.endTime).toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className="border-green-500/30 text-green-400">{a.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">Current Bid</span>
                      <span className="font-bold text-lg">${a.currentBid ?? a.startingPrice}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Your bid"
                        value={bidAmounts[a.id] || ""}
                        onChange={(e) => setBidAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => handleBid(a.id)} disabled={placeBid.isPending}>
                        <Gavel className="mr-1 h-4 w-4" /> Bid
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Gavel} title="No Active Auctions" desc="Check back later for new auctions" />
          )}
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          {collections && collections.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {collections.map((c: any) => (
                <Card key={c.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <h3 className="font-semibold mb-1">{c.name}</h3>
                    {c.description && <p className="text-sm text-muted-foreground mb-2">{c.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{c.totalItems ?? 0} items</span>
                      {c.floorPrice && <span>Floor: ${c.floorPrice}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Star} title="No Collections" desc="Create a collection to organize your NFTs" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NftCard({ nft }: { nft: any }) {
  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors group">
      {nft.imageUrl ? (
        <div className="aspect-square bg-secondary overflow-hidden">
          <img src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        </div>
      ) : (
        <div className="aspect-square bg-secondary flex items-center justify-center">
          <Gem className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm truncate">{nft.name}</h3>
        <div className="flex items-center justify-between mt-2">
          {nft.price ? <span className="text-sm font-bold">${nft.price}</span> : <span className="text-xs text-muted-foreground">Not for sale</span>}
          {nft.rarityScore && (
            <Badge variant="outline" className="text-xs">
              <Star className="h-3 w-3 mr-1" /> {nft.rarityScore}
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="mt-2 text-xs capitalize">{nft.status}</Badge>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
