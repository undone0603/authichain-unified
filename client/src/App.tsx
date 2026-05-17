import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThirdwebAppProvider } from "./components/ThirdwebProvider";
import DashboardLayout from "./components/DashboardLayout";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import RegulatoryDemo from "../app/demos/regulatory-audit/page";

// Lazy load home + dashboard pages
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
const WhiteLabel = lazy(() => import("./pages/WhiteLabel"));
const Pricing = lazy(() => import("./pages/Pricing"));
const GrantHub = lazy(() => import("./pages/Granthub"));
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
const SbaDisasterLoan = lazy(() => import("./pages/SbaDisasterLoan"));
const ScheduledTasks = lazy(() => import("./pages/ScheduledTasks"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const Services = lazy(() => import("./pages/Services"));
const Storymode = lazy(() => import("./pages/Storymode"));

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
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/authenticate" component={Authenticate} />
          <Route path="/qrcodes" component={QrCodes} />
          <Route path="/certificates" component={Certificates} />
          <Route path="/nft-marketplace" component={NftMarketplace} />
          <Route path="/supply-chain" component={SupplyChain} />
          <Route path="/autopilot" component={Autopilot} />
          <Route path="/email-campaigns" component={EmailCampaigns} />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/referrals" component={Referrals} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/white-label" component={WhiteLabel} />
          <Route path="/granthub" component={GrantHub} />
          <Route path="/growth-engine" component={GrowthEngine} />
          <Route path="/blockchain" component={Blockchain} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/crm" component={CRM} />
          <Route path="/heygen" component={HeyGen} />
          <Route path="/macrohard" component={Macrohard} />
          <Route path="/character-dashboard" component={CharacterDashboard} />
          <Route path="/character-create" component={CharacterCreate} />
          <Route path="/gov-onboarding" component={GovOnboarding} />
          <Route path="/network-stats" component={NetworkStats} />
          <Route path="/qr-art-gallery" component={QrArtGallery} />
          <Route path="/sba-disaster-loan" component={SbaDisasterLoan} />
          <Route path="/scheduled-tasks" component={ScheduledTasks} />
          <Route path="/service-orders" component={ServiceOrders} />
          <Route path="/services" component={Services} />
          <Route path="/storymode" component={Storymode} />
          <Route path="/demo" component={RegulatoryDemo} />
          <Route>
            <Redirect to="/dashboard" />
          </Route>
        </Switch>
      </Suspense>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <Home />
          </Suspense>
        )}
      </Route>
      <Route path="/dapp">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/pricing">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <Pricing />
          </Suspense>
        )}
      </Route>
      <Route path="/certificate/:token">
        {(params) => (
          <Suspense fallback={<PageLoader />}>
            <CertificatePublic token={params.token} />
          </Suspense>
        )}
      </Route>
      <Route>
        <DashboardRoutes />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ThirdwebAppProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThirdwebAppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
