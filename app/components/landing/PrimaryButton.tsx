import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline";
};

export function PrimaryButton({ href, children, variant = "solid" }: Props) {
  const className =
    variant === "solid"
      ? "rounded-full bg-white px-6 py-3 font-medium text-black"
      : "rounded-full border border-white/20 px-6 py-3 font-medium text-white";

  return <Link href={href} className={className}>{children}</Link>;
}
