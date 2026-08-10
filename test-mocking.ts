import { vi } from "vitest";
import * as db from "./server/db";

console.log("Original getHyperdriveDb:", typeof db.getHyperdriveDb);

vi.mock("./server/db", () => {
    return {
        getHyperdriveDb: vi.fn(),
    };
});

import * as mockedDb from "./server/db";
console.log("Mocked getHyperdriveDb:", typeof mockedDb.getHyperdriveDb);
