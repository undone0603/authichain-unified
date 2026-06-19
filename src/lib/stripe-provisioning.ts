/**
 * Stripe Metering Infrastructure Provisioning
 *
 * This utility helps provision the Stripe Meters API infrastructure needed for
 * metered billing on the verify endpoint. Run this when setting up a new AuthiChain
 * deployment or when onboarding a new integration partner.
 *
 * Usage:
 *   const provisioning = new StripeProvisioning(stripeSecretKey, connectedAccountId?);
 *   const result = await provisioning.provisionVerifyAPI();
 *   console.log(result.priceId); // Save this to env: STRIPE_VERIFY_METERED_PRICE_ID
 */

import Stripe from 'stripe';

export interface ProvisioningResult {
  meterId?: string;
  priceId?: string;
  productId?: string;
  errors?: string[];
}

export class StripeProvisioning {
  private stripe: Stripe;
  private stripeVersion = '2026-05-27.dahlia' as const;

  constructor(
    secretKey: string,
    private connectedAccountId?: string
  ) {
    this.stripe = new Stripe(secretKey, { apiVersion: this.stripeVersion });
  }

  /**
   * Provision the complete metering setup for the verify API.
   * Steps:
   *   1. Create a meter for verify_product_calls
   *   2. Create or retrieve the product
   *   3. Create a price backed by the meter
   *   4. Return the price ID for use in Stripe Checkout/subscriptions
   */
  async provisionVerifyAPI(): Promise<ProvisioningResult> {
    const errors: string[] = [];

    try {
      // Step 1: Create the meter
      console.log('[Stripe] Creating meter: verify_product_calls...');
      const meter = await this.createMeter('verify_product_calls', {
        display_name: 'AuthiChain Verify API Calls',
        description: 'Metered billing for product verification API calls',
      });

      if (!meter.id) {
        errors.push('Failed to create meter');
        return { errors };
      }

      console.log(`[Stripe] Meter created: ${meter.id}`);

      // Step 2: Create or retrieve product
      console.log('[Stripe] Creating product: AuthiChain Verify API...');
      const product = await this.createProduct({
        name: 'AuthiChain Verify API — Usage-Based Billing',
        type: 'service',
        metadata: {
          authichain_tier: 'verify_api_metered',
          meter_id: meter.id,
        },
      });

      if (!product.id) {
        errors.push('Failed to create product');
        return { errors };
      }

      console.log(`[Stripe] Product created: ${product.id}`);

      // Step 3: Create meter-backed price
      console.log('[Stripe] Creating meter-backed price...');
      const price = await this.createPrice(product.id, meter.id);

      if (!price.id) {
        errors.push('Failed to create price');
        return { errors };
      }

      console.log(`[Stripe] Price created: ${price.id}`);

      return {
        meterId: meter.id,
        priceId: price.id,
        productId: product.id,
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Stripe] Provisioning failed:', msg);
      errors.push(msg);
      return { errors };
    }
  }

  /**
   * Create a meter in Stripe.
   * Meters are used to track usage for metered pricing.
   */
  private async createMeter(
    eventName: string,
    options: { display_name?: string; description?: string }
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metersApi = (this.stripe.billing as any).meters || (this.stripe as any).billing?.meters;

    if (!metersApi) {
      throw new Error(
        'Stripe Meters API not available. Ensure your API version supports billing.meters.'
      );
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meter = await (metersApi.create as any)({
        event_name: eventName,
        display_name: options.display_name || eventName,
        value_settings: {
          event_payload_key: 'value',
        },
        ...(options.description && { description: options.description }),
      });

      return meter;
    } catch (err: unknown) {
      // If meter already exists, try to retrieve it
      if (
        err instanceof Error &&
        err.message.includes('already exists')
      ) {
        console.log(`[Stripe] Meter ${eventName} already exists, retrieving...`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const meters = await (metersApi.list as any)({ limit: 100 });
        const existing = (meters.data || []).find((m: any) => m.event_name === eventName);
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * Create a product in Stripe.
   */
  private async createProduct(options: {
    name: string;
    type: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const product = await this.stripe.products.create(
        {
          name: options.name,
          type: options.type as 'service' | 'good',
          ...(options.metadata && { metadata: options.metadata }),
        },
        this.connectedAccountId ? { stripeAccount: this.connectedAccountId } : undefined
      );
      return product;
    } catch (err: unknown) {
      // If product exists, try to retrieve it
      if (
        err instanceof Error &&
        err.message.includes('already exists')
      ) {
        const products = await this.stripe.products.list(
          { limit: 100, active: true },
          this.connectedAccountId ? { stripeAccount: this.connectedAccountId } : undefined
        );
        const existing = products.data.find(p => p.name === options.name);
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * Create a metered price in Stripe.
   * The price must be backed by a meter created via createMeter().
   */
  private async createPrice(productId: string, meterId: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeAny = this.stripe as any;

    const priceParams = {
      product: productId,
      type: 'recurring',
      recurring: {
        aggregate_usage: 'sum' as const,
        interval: 'month' as const,
        usage_type: 'metered' as const,
        meter: meterId,
      },
      billing_scheme: 'per_unit' as const,
      unit_amount: 5, // $0.05 per unit
      currency: 'usd' as const,
    };

    try {
      const price = await stripeAny.prices.create(
        priceParams,
        this.connectedAccountId ? { stripeAccount: this.connectedAccountId } : undefined
      );
      return price;
    } catch (err: unknown) {
      // If price creation fails due to Meters API incompatibility,
      // provide a helpful error message
      if (
        err instanceof Error &&
        err.message.includes('metered prices must be backed by meters')
      ) {
        throw new Error(
          'Stripe Meters API not available or not configured correctly. ' +
          'Please ensure your Stripe API version (2026-05-27.dahlia or later) supports billing.meters. ' +
          'If you see "metered prices must be backed by meters", the meter may not have been created successfully.'
        );
      }
      throw err;
    }
  }
}

/**
 * Helper function to provision Stripe infrastructure given a secret key.
 * Returns the price ID needed for STRIPE_VERIFY_METERED_PRICE_ID env var.
 */
export async function provisionStripeForVerifyAPI(
  secretKey: string,
  connectedAccountId?: string
): Promise<string | null> {
  const provisioner = new StripeProvisioning(secretKey, connectedAccountId);
  const result = await provisioner.provisionVerifyAPI();

  if (result.errors?.length) {
    console.error('Provisioning errors:', result.errors);
    return null;
  }

  return result.priceId || null;
}
