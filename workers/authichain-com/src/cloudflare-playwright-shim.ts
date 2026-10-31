// @cloudflare/playwright is not a workspace dependency. battery-scraper.ts
// is still typechecked with the workers program, so this names the module.
declare module "@cloudflare/playwright" {
  interface LaunchedPage {
    goto(url: string, options?: { waitUntil?: string }): Promise<unknown>;
    evaluate<T>(pageFunction: () => T): Promise<T>;
  }
  interface LaunchedBrowser {
    newContext(): Promise<{ newPage(): Promise<LaunchedPage> }>;
    close(): Promise<void>;
  }
  export function launch(binding: unknown): Promise<LaunchedBrowser>;
}
