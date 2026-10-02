import type { Metadata } from "next";
import SiFeedClient from "./si-feed-client";

export const metadata: Metadata = {
  title: "AuthiChain SI Feed — company signals, one stream",
  description:
    "A live, human-readable stream for the systems moving AuthiChain. Built by @undone0603.",
  alternates: {
    canonical: "https://authichain.com/si-feed",
  },
  authors: [{ name: "@undone0603", url: "https://github.com/undone0603" }],
  openGraph: {
    title: "AuthiChain SI Feed",
    description: "Every signal. One stream. Built by @undone0603.",
    url: "https://authichain.com/si-feed",
    siteName: "AuthiChain",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AuthiChain SI Feed",
    description: "Every signal. One stream. Built by @undone0603.",
  },
};

export default function SiFeedPage() {
  return <SiFeedClient />;
}
