CREATE INDEX `authentications_product_id_idx` ON `authentications` (`productId`);--> statement-breakpoint
CREATE INDEX `certificates_certificate_number_idx` ON `certificates` (`certificateNumber`);--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `products_user_id_idx` ON `products` (`userId`);--> statement-breakpoint
CREATE INDEX `referrals_referrer_id_idx` ON `referrals` (`referrerId`);--> statement-breakpoint
CREATE INDEX `subscriptions_user_id_idx` ON `subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_stripe_customer_id_idx` ON `users` (`stripeCustomerId`);