import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Loader2, Copy, DollarSign, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function Referrals() {
  const { data: referrals, isLoading } = trpc.referral.getHistory.useQuery();
  const { data: affiliate } = trpc.affiliate.getStatus.useQuery();
  const { data: affiliateStats } = trpc.affiliate.getStats.useQuery();
  const genCode = trpc.referral.generateCode.useMutation();
  const joinAffiliate = trpc.affiliate.submitApplication.useMutation();
  const utils = trpc.useUtils();

  const handleGenCode = async () => {
    try {
      await genCode.mutateAsync();
      toast.success("Referral code generated");
      utils.referral.getHistory.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleJoinAffiliate = async () => {
    try {
      await joinAffiliate.mutateAsync({});
      toast.success("Joined affiliate program");
      utils.affiliate.getStatus.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  };

  const commissions = affiliateStats?.commissions;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals & Affiliates</h1>
        <p className="text-muted-foreground text-sm mt-1">Earn commissions by referring new users to AuthiChain</p>
      </div>

      <Tabs defaultValue="referrals">
        <TabsList>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate Program</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Your Referral Codes</CardTitle>
                <Button size="sm" onClick={handleGenCode} disabled={genCode.isPending}>
                  {genCode.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />} Generate Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : referrals && referrals.length > 0 ? (
                <div className="space-y-2">
                  {referrals.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                      <div>
                        <span className="font-mono text-sm">{r.referralCode}</span>
                        <Badge variant="outline" className="ml-2 text-xs capitalize">{r.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.commission && <span className="text-sm text-green-400">${r.commission}</span>}
                        <Button variant="ghost" size="sm" onClick={() => copyCode(r.referralCode)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No referral codes yet. Generate one to start earning.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affiliate" className="mt-4 space-y-4">
          {affiliate ? (
            <>
              <Card className="border-primary/30">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Affiliate Code</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-lg">{affiliate.affiliateCode}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyCode(affiliate.affiliateCode)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">{affiliate.status}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Commission Rate</p>
                      <p className="text-lg font-bold">{affiliate.commissionRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Earned</p>
                      <p className="text-lg font-bold text-green-400">${affiliate.totalEarnings || "0.00"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pending Payout</p>
                      <p className="text-lg font-bold">${affiliate.pendingPayout || "0.00"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Commission History</CardTitle></CardHeader>
                <CardContent>
                  {commissions && commissions.length > 0 ? (
                    <div className="space-y-2">
                      {commissions.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                          <div>
                            <span className="text-sm capitalize">{c.type}</span>
                            <Badge variant="outline" className="ml-2 text-xs capitalize">{c.status}</Badge>
                          </div>
                          <span className="text-sm font-bold text-green-400">${c.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <DollarSign className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No commissions yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Join the Affiliate Program</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">Earn 10% commission on every sale you refer. Get your unique affiliate code and start earning today.</p>
                <Button onClick={handleJoinAffiliate} disabled={joinAffiliate.isPending}>
                  {joinAffiliate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Join Now
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
