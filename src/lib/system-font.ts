/** No network. Used instead of next/font/google so Workers Builds do not fetch Google. */
export function systemFont(opts: { variable?: string } = {}) {
  return {
    className: "",
    variable: opts.variable ?? "",
    style: { fontFamily: "system-ui, sans-serif" },
  };
}
