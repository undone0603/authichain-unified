import { resolveBrand } from '../../shared/brands';
/**
 * Attaches the active brand (derived from the Host header) to
 * `res.locals.brand` and sets an `X-Brand` response header.
 *
 * The client resolves its own brand a second time from `window.location.hostname`
 * inside BrandContext — this middleware exists so server-side code (tRPC
 * handlers, analytics, logs) can see which brand the request came in on.
 */
export const brandMiddleware = (req, res, next) => {
    const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? '';
    const brand = resolveBrand(host);
    res.locals.brand = brand;
    res.setHeader('X-Brand', brand);
    next();
};
/**
 * Builds the `<script>window.__BRAND__ = '<id>';</script>` snippet that
 * injects the brand into the HTML before React mounts. Used by the
 * Vite dev middleware and the static-serve fallback. Safe to inline
 * because brand id is a closed union of 4 known strings.
 */
export function brandInjectionScript(brand) {
    return `<script>window.__BRAND__=${JSON.stringify(brand)};document.documentElement.setAttribute('data-brand',${JSON.stringify(brand)});</script>`;
}
