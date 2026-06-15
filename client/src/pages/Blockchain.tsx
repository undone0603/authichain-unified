/**
 * Blockchain Dashboard - Thirdweb integration hub
 * Shows connection status, IPFS operations, NFT minting, and wallet management.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { WalletConnect, BlockchainStatusBadge } from "@/components/WalletConnect";
import { trpc } from "@/lib/trpc";
import { getChainName, getExplorerUrl, getIPFSUrl, shortenAddress } from "@/lib/thirdweb";
import { useState } from "react";
import { toast } from "sonner";
import {
  Link2, Shield, Gem, Upload, CheckCircle2, XCircle,
  ExternalLink, Copy, Loader2, Boxes, Wallet, Globe,
  FileJson, Image as ImageIcon, Hash, Sparkles
} from "lucide-react";

function ConnectionStatus() {
  const { data: status, isLoading } = trpc.blockchain.status.useQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Blockchain Connection
        </CardTitle>
        <CardDescription>Thirdweb SDK integration status</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection...
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-green-500">Connected</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Client ID</p>
                <p className="font-mono text-sm">{shortenAddress(status.clientId || "")}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Active Chain</p>
                <p className="font-mono text-sm">{status.chain}</p>
              </div>
            </div>
            <div className="pt-2">
              <WalletConnect size="md" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-500">Not Connected</span>
            </div>
            {status?.error && (
              <p className="text-sm text-muted-foreground">{status.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IPFSUploader() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [lastUri, setLastUri] = useState<string | null>(null);

  const uploadMutation = trpc.blockchain.uploadToIPFS.useMutation({
    onSuccess: (data) => {
      setLastUri(data.ipfsUri);
      toast.success("Metadata uploaded to IPFS!");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" />
          IPFS Upload
        </CardTitle>
        <CardDescription>Upload metadata to IPFS via Thirdweb Storage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input placeholder="Authentication Certificate #001" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea placeholder="Blockchain-verified authentication certificate..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Image URL (optional)</Label>
          <Input placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
        </div>
        <Button
          onClick={() => uploadMutation.mutate({ name, description, imageUrl: imageUrl || undefined })}
          disabled={!name || uploadMutation.isPending}
          className="w-full"
        >
          {uploadMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />Upload to IPFS</>
          )}
        </Button>
        {lastUri && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
            <div className="flex items-center gap-2 text-green-500 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Upload Successful
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted p-1 rounded flex-1 overflow-hidden text-ellipsis">{lastUri}</code>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(lastUri); toast.success("Copied!"); }}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={getIPFSUrl(lastUri)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NFTMinter() {
  const [nftName, setNftName] = useState("");
  const [nftDesc, setNftDesc] = useState("");
  const [nftImage, setNftImage] = useState("");
  const [walletAddr, setWalletAddr] = useState("");
  const [contractAddr, setContractAddr] = useState("");
  const [chainId, setChainId] = useState<number>(137); // Default to Polygon
  const [lastTx, setLastTx] = useState<{ hash: string; chain: number; uri: string } | null>(null);

  const mintMutation = trpc.blockchain.mintNFT.useMutation({
    onSuccess: (data) => {
      setLastTx({ hash: data.transactionHash, chain: data.chain, uri: data.metadataUri });
      toast.success("NFT minted successfully!");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Gem className="h-5 w-5" />
          Mint NFT
        </CardTitle>
        <CardDescription>Mint authentication NFTs on-chain via Thirdweb</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>NFT Name</Label>
            <Input placeholder="AuthiChain Certificate #001" value={nftName} onChange={e => setNftName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Image URL</Label>
            <Input placeholder="https://..." value={nftImage} onChange={e => setNftImage(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea placeholder="Blockchain-verified authentication certificate..." value={nftDesc} onChange={e => setNftDesc(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Contract Address</Label>
            <Input placeholder="0x..." value={contractAddr} onChange={e => setContractAddr(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Recipient Wallet</Label>
            <Input placeholder="0x..." value={walletAddr} onChange={e => setWalletAddr(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Chain ID</Label>
          <Input type="number" value={chainId} onChange={e => setChainId(Number(e.target.value))} />
        </div>
        <Button
          onClick={() => mintMutation.mutate({
            name: nftName, description: nftDesc, imageUrl: nftImage || undefined,
            walletAddress: walletAddr, contractAddress: contractAddr,
            chainId,
          })}
          disabled={!nftName || !walletAddr || !contractAddr || mintMutation.isPending}
          className="w-full"
        >
          {mintMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Minting...</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" />Mint NFT</>
          )}
        </Button>
        {lastTx && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2">
            <div className="flex items-center gap-2 text-green-500 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              NFT Minted on {getChainName(lastTx.chain)}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Hash className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">TX:</span>
                <a href={getExplorerUrl(lastTx.chain, lastTx.hash)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                  {shortenAddress(lastTx.hash)}
                  <ExternalLink className="h-3 w-3 inline ml-1" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <FileJson className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">IPFS:</span>
                <a href={getIPFSUrl(lastTx.uri)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">
                  {lastTx.uri.substring(0, 30)}...
                  <ExternalLink className="h-3 w-3 inline ml-1" />
                </a>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractExplorer() {
  const [contractAddr, setContractAddr] = useState("");
  const [walletAddr, setWalletAddr] = useState("");

  const supplyQuery = trpc.blockchain.getContractSupply.useQuery(
    { contractAddress: contractAddr },
    { enabled: contractAddr.length >= 42 }
  );

  const balanceQuery = trpc.blockchain.getNFTBalance.useQuery(
    { contractAddress: contractAddr, walletAddress: walletAddr },
    { enabled: contractAddr.length >= 42 && walletAddr.length >= 42 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Boxes className="h-5 w-5" />
          Contract Explorer
        </CardTitle>
        <CardDescription>Query on-chain data from any ERC-721 contract</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Contract Address</Label>
          <Input placeholder="0x..." value={contractAddr} onChange={e => setContractAddr(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Wallet Address (optional, for balance check)</Label>
          <Input placeholder="0x..." value={walletAddr} onChange={e => setWalletAddr(e.target.value)} />
        </div>
        {contractAddr.length >= 42 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-xs text-muted-foreground">Total Supply</p>
              <p className="text-xl font-bold">
                {supplyQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : supplyQuery.data?.totalSupply || "—"}
              </p>
            </div>
            {walletAddr.length >= 42 && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="text-xs text-muted-foreground">Wallet Balance</p>
                <p className="text-xl font-bold">
                  {balanceQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : balanceQuery.data?.balance || "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Blockchain() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Blockchain Hub
          </h1>
          <p className="text-muted-foreground">
            Thirdweb-powered blockchain operations: IPFS storage, NFT minting, and on-chain verification
          </p>
        </div>
        <WalletConnect size="md" />
      </div>

      <ConnectionStatus />

      <Tabs defaultValue="ipfs">
        <TabsList>
          <TabsTrigger value="ipfs">
            <Upload className="h-4 w-4 mr-1" />
            IPFS Upload
          </TabsTrigger>
          <TabsTrigger value="mint">
            <Gem className="h-4 w-4 mr-1" />
            Mint NFT
          </TabsTrigger>
          <TabsTrigger value="explorer">
            <Boxes className="h-4 w-4 mr-1" />
            Contract Explorer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ipfs" className="mt-4">
          <IPFSUploader />
        </TabsContent>

        <TabsContent value="mint" className="mt-4">
          <NFTMinter />
        </TabsContent>

        <TabsContent value="explorer" className="mt-4">
          <ContractExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
