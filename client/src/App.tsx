import * as React from "react";
import { lazy, Suspense } from "react";
import { Route as WRoute, Switch, Redirect } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThirdwebProvider } from "./components/ThirdwebProvider";
import DashboardLayout from "./components/DashboardLayout";

const Home = lazy(() => import("./pages/brand/AuthiChainHome"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Authenticate = lazy(() => import("./pages/Authenticate"));
const QrCodes = lazy(() => import("./pages/QrCodes"));
const Certificates = lazy(() => import("./pages/Certificates"));
const CertificatePublic = lazy(() => import("./pages/CertificatePublic"));
const NftMarketplace = lazy(() => import("./pages/NftMarketplace"));
const SupplyChain = lazy(() => import("./pages/SupplyChain"));
const Autopilot = lazy(() => import("./pages/Autopilot"));
const EmailCampaigns = lazy(() => import("./pages/EmailCampaigns"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const Referrals = lazy(() => import("./pages/Referrals"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Services = lazy(() => import("./pages/Services"));
const Storymode = lazy(() => import("./pages/Storymode"));
const ROICalculator = lazy(() => import("./pages/ROICalculator"));
const InvestorPortal = lazy(() => import("./pages/InvestorPortal"));
const Whitepapers = lazy(() => import("./pages/Whitepapers"));
const Pricing = lazy(() => import("./pages/Pricing"));
const RegulatoryDemo = lazy(() => import("./pages/RegulatoryDemo"));
const WhiteLabel = lazy(() => import("./pages/WhiteLabel"));
const GrantHub = lazy(() => import("./pages/GrantHub"));
const GrowthEngine = lazy(() => import("./pages/GrowthEngine"));
const Blockchain = lazy(() => import("./pages/Blockchain"));
const Notifications = lazy(() => import("./pages/Notifications"));
const CRM = lazy(() => import("./pages/CRM"));
const HeyGen = lazy(() => import("./pages/HeyGen"));
const Macrohard = lazy(() => import("./pages/Macrohard"));
const CharacterDashboard = lazy(() => import("./pages/CharacterDashboard"));
const CharacterCreate = lazy(() => import("./pages/CharacterCreate"));
const GovOnboarding = lazy(() => import("./pages/GovOnboarding"));
const NetworkStats = lazy(() => import("./pages/NetworkStats"));
const QrArtGallery = lazy(() => import("./pages/QrArtGallery"));
const Verify = lazy(() => import("./pages/Verify"));
const SbaDisasterLoan = lazy(() => import("./pages/SbaDisasterLoan"));
const ScheduledTasks = lazy(() => import("./pages/ScheduledTasks"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const AutonomousControl = lazy(() => import("./pages/AutonomousControl"));
const Missions = lazy(() => import("./pages/Missions"));
const BuildLoop = lazy(() => import("./pages/BuildLoop"));
const PhysicalAuth = lazy(() => import("./pages/PhysicalAuth"));
const Staking = lazy(() => import("./pages/Staking"));
const VideoStudio = lazy(() => import("./pages/VideoStudio"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <WRoute path="/dashboard" component={Dashboard} />
          <WRoute path="/authenticate" component={Authenticate} />
          <WRoute path="/qr-codes" component={QrCodes} />
          <WRoute path="/certificates" component={Certificates} />
          <WRoute path="/nft" component={NftMarketplace} />
          <WRoute path="/supply-chain" component={SupplyChain} />
          <WRoute path="/autopilot" component={Autopilot} />
          <WRoute path="/email-campaigns" component={EmailCampaigns} />
          <WRoute path="/subscriptions" component={Subscriptions} />
          <WRoute path="/referrals" component={Referrals} />
          <WRoute path="/admin" component={AdminDashboard} />
          <WRoute path="/admin/users" component={AdminDashboard} />
          <WRoute path="/white-label" component={WhiteLabel} />
          <WRoute path="/grants" component={GrantHub} />
          <WRoute path="/growth" component={GrowthEngine} />
          <WRoute path="/blockchain" component={Blockchain} />
          <WRoute path="/notifications" component={Notifications} />
          <WRoute path="/crm" component={CRM} />
          <WRoute path="/heygen" component={HeyGen} />
          <WRoute path="/macrohard" component={Macrohard} />
          <WRoute path="/character" component={CharacterDashboard} />
          <WRoute path="/character/create" component={CharacterCreate} />
          <WRoute path="/gov-onboarding" component={GovOnboarding} />
          <WRoute path="/network-stats" component={NetworkStats} />
          <WRoute path="/qr-gallery" component={QrArtGallery} />
          <WRoute path="/sba-loan" component={SbaDisasterLoan} />
          <WRoute path="/scheduled-tasks" component={ScheduledTasks} />
          <WRoute path="/service-orders" component={ServiceOrders} />
          <WRoute path="/autonomous" component={AutonomousControl} />
          <WRoute path="/missions" component={Missions} />
          <WRoute path="/build-loop" component={BuildLoop} />
          <WRoute path="/physical-auth" component={PhysicalAuth} />
          <WRoute path="/staking" component={Staking} />
          <WRoute path="/video-studio" component={VideoStudio} />
          <WRoute path="/services" component={Services} />
          <WRoute path="/storymode" component={Storymode} />
          <WRoute path="/regulatory-demo" component={RegulatoryDemo} />
          <WRoute component={NotFound} />
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function AppRouter() {
  return (
    <Switch>
      <WRoute path="/" component={Home} />
      <WRoute path="/dapp">
        <Redirect to="/dashboard" />
      </WRoute>
      <WRoute path="/demo">
        <Redirect to="/subscriptions" />
      </WRoute>
      <WRoute path="/roi-calculator" component={ROICalculator} />
      <WRoute path="/pricing" component={Pricing} />
      <WRoute path="/investor-portal" component={InvestorPortal} />
      <WRoute path="/whitepapers" component={Whitepapers} />
      <WRoute path="/certificate/:token">
        {({ token }: { token?: string }) => (
          <Suspense fallback={<PageLoader />}>
            <CertificatePublic token={token ?? ""} />
          </Suspense>
        )}
      </WRoute>
      <WRoute path="/verify/:productId">
        {({ productId }: { productId?: string }) => (
          <Suspense fallback={<PageLoader />}>
            <Verify productId={productId ?? ""} />
          </Suspense>
        )}
      </WRoute>
      <WRoute path="/:rest*">
        <DashboardRoutes />
      </WRoute>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ThirdwebProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </ThirdwebProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
