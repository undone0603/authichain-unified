// Ambient stubs for packages that are declared in package.json but not yet installed.
// Remove this file after running `pnpm install`.

declare module "@sendgrid/mail" {
  interface MailDataRequired {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
  }
  function setApiKey(key: string): void;
  function send(data: MailDataRequired): Promise<any>;
  export { setApiKey, send };
  export default { setApiKey, send };
}

declare module "nodemailer" {
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  }
  export interface Transporter {
    sendMail(options: any): Promise<any>;
    verify(): Promise<any>;
  }
  export function createTransport(options: TransportOptions): Transporter;
  export default { createTransport };
}

declare module "@paddle/paddle-node-sdk" {
  export enum Environment {
    production = "production",
    sandbox = "sandbox",
  }
  export type EventName = string;
  export interface PaddleOptions {
    environment?: Environment;
  }
  export class Paddle {
    constructor(apiKey: string, options?: PaddleOptions);
    customers: {
      list(params: any): Promise<{ data?: any[] }>;
      create(params: any): Promise<{ id: string }>;
    };
    transactions: {
      create(params: any): Promise<any>;
    };
    subscriptions: {
      cancel(id: string, params: any): Promise<any>;
    };
    webhooks: {
      unmarshal(body: string, secret: string, signature: string): Promise<any>;
    };
  }
}
