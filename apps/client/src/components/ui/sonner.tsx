import { Toaster as Sonner, type ToasterProps } from "sonner";

// AuthiChain ships a single dark "Protocol" theme (see client/src/index.css :root),
// so the toaster is pinned to dark rather than pulling in a theme provider.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
