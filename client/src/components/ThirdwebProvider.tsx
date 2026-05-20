import { ThirdwebProvider as TWProvider } from "thirdweb/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function ThirdwebProvider({ children }: Props) {
  return <TWProvider>{children}</TWProvider>;
}
