import { agentzExecutionPolicy } from "../../src/lib/economic-authority.ts";

const decision = agentzExecutionPolicy(process.argv[2] ?? "");
process.stdout.write(JSON.stringify(decision));
process.exit(decision.allowed ? 0 : 3);
