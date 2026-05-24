import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <article className={`rounded-3xl border border-white/10 bg-white/5 p-6 ${className}`.trim()}>
      {children}
    </article>
  );
}
