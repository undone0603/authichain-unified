import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Shield, QrCode, Award,
  Gem, CreditCard, Bot, Mail, Truck, Users, BarChart3,
  Building2, Link2, Settings, Rocket, DollarSign, TrendingUp, Blocks, Bell, Video, Cpu,
<<<<<<< HEAD
  Sparkles, Landmark, Activity, Image, Calendar, ShoppingCart, Briefcase, BookOpen, HandCoins, Zap,
=======
  Sparkles, Landmark, Activity, Image, Calendar, ShoppingCart, Briefcase, BookOpen, HandCoins,
  Leaf, Flag,
>>>>>>> origin/add-agentz-editable
} from "lucide-react";
import NotificationBell from "./NotificationBell";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useBrand } from "@/contexts/BrandContext";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Shield, label: "Authenticate", path: "/authenticate" },
  { icon: QrCode, label: "QR Codes", path: "/qr-codes" },
  { icon: Award, label: "Certificates", path: "/certificates" },
  { icon: Gem, label: "NFT Marketplace", path: "/nft" },
  { icon: Truck, label: "Supply Chain", path: "/supply-chain" },
  { icon: Bot, label: "AI Autopilot", path: "/autopilot" },
  { icon: Zap, label: "Autonomous Control", path: "/autonomous" },
  { icon: Mail, label: "Email Campaigns", path: "/email-campaigns" },
  { icon: CreditCard, label: "Subscriptions", path: "/subscriptions" },
  { icon: Link2, label: "Referrals", path: "/referrals" },
  { icon: Blocks, label: "Blockchain Hub", path: "/blockchain" },
  { icon: Bell, label: "Notifications", path: "/notifications" },
  { icon: Sparkles, label: "AI Characters", path: "/character" },
  { icon: Image, label: "QR Art Gallery", path: "/qr-gallery" },
  { icon: BookOpen, label: "Story Mode", path: "/storymode" },
  { icon: Briefcase, label: "Services", path: "/services" },
  { icon: ShoppingCart, label: "Service Orders", path: "/service-orders" },
];

const adminMenuItems = [
  { icon: BarChart3, label: "Admin Dashboard", path: "/admin" },
  { icon: Building2, label: "White Label", path: "/white-label" },
  { icon: Rocket, label: "Grants & Partners", path: "/grants" },
  { icon: TrendingUp, label: "Growth Engine", path: "/growth" },
  { icon: Users, label: "Manage Users", path: "/admin/users" },
  { icon: DollarSign, label: "CRM (HubSpot)", path: "/crm" },
  { icon: Video, label: "AI Avatar Videos", path: "/heygen" },
  { icon: Cpu, label: "MACROHARD", path: "/macrohard" },
  { icon: Activity, label: "Network Stats", path: "/network-stats" },
  { icon: Calendar, label: "Scheduled Tasks", path: "/scheduled-tasks" },
  { icon: Landmark, label: "Gov Onboarding", path: "/gov-onboarding" },
  { icon: HandCoins, label: "SBA Loan Hub", path: "/sba-loan" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

const BRAND_ICONS: Record<string, React.ElementType> = {
  authichain: Shield,
  qron: QrCode,
  strainchain: Leaf,
  govchain: Landmark,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { brandId, brand } = useBrand();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    const BrandIcon = BRAND_ICONS[brandId] || Shield;
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <BrandIcon className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold gradient-text">{brand.displayName}</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to the {brand.displayName} platform requires authentication.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { brandId, brand } = useBrand();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allItems = [...menuItems, ...(user?.role === "admin" ? adminMenuItems : [])];
  const activeMenuItem = allItems.find(item => location.startsWith(item.path));
  const isMobile = useIsMobile();
  const BrandIcon = BRAND_ICONS[brandId] || Shield;

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <BrandIcon className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold tracking-tight truncate gradient-text">{brand.displayName}</span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path || (item.path !== "/dashboard" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal text-[13px]"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {user?.role === "admin" && (
              <>
                {!isCollapsed && (
                  <div className="px-4 py-2 mt-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Admin</span>
                  </div>
                )}
                <SidebarMenu className="px-2 py-1">
                  {adminMenuItems.map(item => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-9 transition-all font-normal text-[13px]"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">{user?.email || "-"}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/subscriptions")} className="cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Subscription</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground">{activeMenuItem?.label ?? "Menu"}</span>
            </div>
            <NotificationBell />
          </div>
        )}
        {!isMobile && (
          <div className="flex border-b h-14 items-center justify-end bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <NotificationBell />
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

