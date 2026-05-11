import { Stripe } from 'stripe';

export const handleStripeWebhook = async (event: Stripe.Event) => {
  switch (event.type) {
    case 'customer.subscription.created':
      console.log('Subscription created:', event.data.object);
      break;
    case 'customer.subscription.updated':
      console.log('Subscription updated:', event.data.object);
      break;
    case 'customer.subscription.deleted':
      console.log('Subscription deleted:', event.data.object);
      break;
    default:
      console.log('Unhandled event type ' + event.type);
  }
};
