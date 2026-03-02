/**
 * ThirdwebProvider - Wraps the app with Thirdweb context for wallet connections
 * and blockchain interactions on the frontend.
 */
import { ThirdwebProvider as TWProvider } from "thirdweb/react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function ThirdwebAppProvider({ children }: Props) {
  return <TWProvider>{children}</TWProvider>;
}
