import type { Metadata } from "next";
import Folio from "./folio";

export const metadata: Metadata = {
  title: "Bench — the folio",
  description:
    "A bound kit and a personnel book. One payment of $97. One job. Every decision leaves a fingerprint of the words.",
};

export default function BenchPage() {
  return <Folio />;
}
