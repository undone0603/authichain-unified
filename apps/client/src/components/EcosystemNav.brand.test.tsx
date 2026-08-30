import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EcosystemNav } from "./EcosystemNav";
import { BrandProvider } from "@/contexts/BrandContext";
import React from "react";

describe("EcosystemNav requires a mounted BrandProvider", () => {
  it("renders the ecosystem strip when wrapped in a BrandProvider", () => {
    render(
      <BrandProvider>
        <EcosystemNav />
      </BrandProvider>
    );
    expect(screen.getByText("AuthiChain")).toBeInTheDocument();
    expect(screen.getByText("QRON")).toBeInTheDocument();
  });
});
