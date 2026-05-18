import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThirdwebProvider } from "./components/ThirdwebProvider";
import DashboardLayout from "./components/DashboardLayout";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import RegulatoryDemo from "./pages/RegulatoryDemo";
import Pricing from "./pages/Pricing";

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
const NetworkStats = lazy(() => import("./pages/NetworkStats"));
const ServiceOrders = lazy(() => import("./pages/ServiceOrders"));
const Services = lazy(() => import("./pages/Services"));
const Storymode = lazy(() => import("./pages/Storymode"));
const SbaDisasterLoan = lazy(() => import("./pages/SbaDisasterLoan"));
const ScheduledTasks = lazy(() => import("./pages/ScheduledTasks"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/authenticate" component={Authenticate} />
          <Route path="/qr-codes" component={QrCodes} />
          <Route path="/certificates" component={Certificates} />
          <Route path="/marketplace" component={NftMarketplace} />
          <Route path="/supply-chain" component={SupplyChain} />
          <Route path="/autopilot" component={Autopilot} />
          <Route path="/email-campaigns" component={EmailCampaigns} />
          <Route path="/subscriptions" component={Subscriptions} />
          <Route path="/referrals" component={Referrals} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/network-stats" component={NetworkStats} />
          <Route path="/service-orders" component={ServiceOrders} />
          <Route path="/services" component={Services} />
          <Route path="/storymode" component={Storymode} />
          <Route path="/sba-disaster-loan" component={SbaDisasterLoan} />
          <Route path="/scheduled-tasks" component={ScheduledTasks} />
          <Route path="/regulatory-compliance" component={RegulatoryDemo} />
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
      <Route path="/certificate/:id">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <CertificatePublic />
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
      <Route path="/dashboard/:path*">
        <DashboardRoutes />
      </Route>
      <Route path="/authenticate" component={DashboardRoutes} />
      <Route path="/qr-codes" component={DashboardRoutes} />
      <Route path="/certificates" component={DashboardRoutes} />
      <Route path="/marketplace" component={DashboardRoutes} />
      <Route path="/supply-chain" component={DashboardRoutes} />
      <Route path="/autopilot" component={DashboardRoutes} />
      <Route path="/email-campaigns" component={DashboardRoutes} />
      <Route path="/subscriptions" component={DashboardRoutes} />
      <Route path="/referrals" component={DashboardRoutes} />
      <Route path="/admin" component={DashboardRoutes} />
      <Route path="/network-stats" component={DashboardRoutes} />
      <Route path="/service-orders" component={DashboardRoutes} />
      <Route path="/services" component={DashboardRoutes} />
      <Route path="/storymode" component={DashboardRoutes} />
      <Route path="/sba-disaster-loan" component={DashboardRoutes} />
      <Route path="/scheduled-tasks" component={DashboardRoutes} />
      <Route path="/regulatory-compliance" component={DashboardRoutes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="authichain-theme">
      <ThirdwebProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Router />
            <Toaster />
          </ErrorBoundary>
        </TooltipProvider>
      </ThirdwebProvider>
    </ThemeProvider>
  );
}

export default App;
