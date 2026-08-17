import { sdk } from "./sdk";
import { DbMissionsRepository } from "../missions/db-repository";
import { DbAdminRepository } from "../admin/db-repository";
export async function createContext(opts) {
    let user = null;
    try {
        user = await sdk.authenticateRequest(opts.req);
    }
    catch (error) {
        // Authentication is optional for public procedures.
        user = null;
    }
    return {
        req: opts.req,
        res: opts.res,
        user,
        missionsRepo: new DbMissionsRepository(),
        adminRepo: new DbAdminRepository(),
    };
}
