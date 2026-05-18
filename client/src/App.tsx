import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThirdwebProvider } from "./components/ThirdwebProvider";
import DashboardLayout from "./components/DashboardLayout";
import { lazy, Suspense } from "react";
import RegulatoryDemo from "./pages/RegulatoryDemo";
import Pricing from "./pages/Pricing";

// Simple spinner component to replace missing Loader2
const Loader = () => (
  <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

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
const Services = lazy(() => import("./pages/Services"));

function App() {
  return (
    <ThemeProvider>
      <ThirdwebProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-screen">
                <Loader />
              </div>
            }>
              <DashboardLayout>
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/dashboard" component={Dashboard} />
                  <Route path="/authenticate" component={Authenticate} />
                  <Route path="/qrcodes" component={QrCodes} />
                  <Route path="/certificates" component={Certificates} />
                  <Route path="/certificates/public/:id" component={CertificatePublic} />
                  <Route path="/marketplace" component={NftMarketplace} />
                  <Route path="/supplychain" component={SupplyChain} />
                  <Route path="/autopilot" component={Autopilot} />
                  <Route path="/email-campaigns" component={EmailCampaigns} />
                  <Route path="/subscriptions" component={Subscriptions} />
                  <Route path="/referrals" component={Referrals} />
                  <Route path="/admin" component={AdminDashboard} />
                  <Route path="/services" component={Services} />
                  <Route path="/pricing" component={Pricing} />
                  <Route path="/regulatory-demo" component={RegulatoryDemo} />
                  <Route component={NotFound} />
                </Switch>
              </DashboardLayout>
            </Suspense>
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </ThirdwebProvider>
    </ThemeProvider>
  );
}

export default App;
