export const chromium = {
  async launch(): Promise<never> {
    throw new Error(
      "Browser automation is unavailable in the Cloudflare Worker runtime."
    );
  },
};
