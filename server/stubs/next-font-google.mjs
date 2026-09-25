// Build-time stand-in for next/font/google.
// Cloudflare Workers Builds cannot fetch fonts.googleapis.com reliably.
// next/font then throws `Cannot read properties of null (reading '1')`
// inside the Google font loader (seen on Public_Sans in src/app/genetics).
// next.config.js aliases `next/font/google` here only when WORKERS_CI=1.
// CSS variables still get set so existing className strings keep working.
// The face falls back to the system stack. No network. No font files.

function font(opts = {}) {
  return {
    className: "",
    variable: opts.variable || "",
    style: { fontFamily: "system-ui, sans-serif" },
  };
}

export const Fraunces = font;
export const Public_Sans = font;
export const IBM_Plex_Mono = font;
export const Geist = font;
export const Geist_Mono = font;
export const Inter = font;
export default font;
