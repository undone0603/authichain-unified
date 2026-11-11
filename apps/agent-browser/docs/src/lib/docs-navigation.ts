export type NavItem = {
  name: string;
  href: string;
};

export type NavSection = {
  title: string | null;
  items: NavItem[];
};

export const navigation: NavSection[] = [
  {
    title: null,
    items: [
      { name: "Introduction", href: "/" },
      { name: "Installation", href: "/installation" },
      { name: "Quick Start", href: "/quick-start" },
      { name: "Skills", href: "/skills" },
    ],
  },
  {
    title: "Authentic Economy",
    items: [
      { name: "The Vision", href: "/authentic-economy" },
      { name: "QRON", href: "/qron" },
      { name: "StrainChain", href: "/strainchain" },
      { name: "Trust Score", href: "/trust-score" },
    ],
  },
  {
    title: "Reference",
    items: [
      { name: "Commands", href: "/commands" },
      { name: "Configuration", href: "/configuration" },
      { name: "Selectors", href: "/selectors" },
      { name: "Snapshots", href: "/snapshots" },
    ],
  },
  {
    title: "Features",
    items: [
      { name: "Sessions", href: "/sessions" },
      { name: "Diffing", href: "/diffing" },
      { name: "CDP Mode", href: "/cdp-mode" },
      { name: "Streaming", href: "/streaming" },
      { name: "Profiler", href: "/profiler" },
      { name: "iOS Simulator", href: "/ios" },
      { name: "Security", href: "/security" },
      { name: "Vision Mode", href: "/vision" },
      { name: "Next.js + Vercel", href: "/next" },
      { name: "Native Mode (Experimental)", href: "/native-mode" },
    ],
  },
  {
    title: "Engines",
    items: [
      { name: "Chrome", href: "/engines/chrome" },
      { name: "Lightpanda", href: "/engines/lightpanda" },
    ],
  },
  {
    title: null,
    items: [{ name: "Changelog", href: "/changelog" }],
  },
];

export const allDocsPages: NavItem[] = navigation.flatMap(
  (section) => section.items
);
