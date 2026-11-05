PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_number` text NOT NULL,
	`type` text DEFAULT 'individual' NOT NULL,
	`name` text NOT NULL,
	`business_name` text,
	`business_name_normalized` text,
	`phone` text NOT NULL,
	`phone_normalized` text NOT NULL,
	`email` text,
	`email_normalized` text,
	`website` text,
	`industry` text,
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`district` text,
	`state` text,
	`postal_code` text,
	`country` text DEFAULT 'India',
	`gstin` text,
	`notes` text,
	`source` text,
	`status` text DEFAULT 'active' NOT NULL,
	`status_before_archive` text,
	`archived_at` text,
	`assigned_to` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "customers_type_check" CHECK("__new_customers"."type" in ('individual', 'business')),
	CONSTRAINT "customers_status_check" CHECK("__new_customers"."status" in ('active', 'inactive', 'archived')),
	CONSTRAINT "customers_name_length_check" CHECK(length("__new_customers"."name") between 1 and 160),
	CONSTRAINT "customers_phone_length_check" CHECK(length("__new_customers"."phone_normalized") between 5 and 20),
	CONSTRAINT "customers_email_lowercase_check" CHECK("__new_customers"."email" is null or "__new_customers"."email" = lower("__new_customers"."email")),
	CONSTRAINT "customers_archived_at_check" CHECK(("__new_customers"."status" = 'archived' and "__new_customers"."archived_at" is not null) or ("__new_customers"."status" != 'archived' and "__new_customers"."archived_at" is null))
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "customer_number", "type", "name", "business_name", "business_name_normalized", "phone", "phone_normalized", "email", "email_normalized", "website", "industry", "address_line1", "address_line2", "city", "district", "state", "postal_code", "country", "gstin", "notes", "source", "status", "status_before_archive", "archived_at", "assigned_to", "created_by", "created_at", "updated_at") SELECT "id", "customer_number", "type", "name", "business_name", "business_name_normalized", "phone", "phone_normalized", "email", "email_normalized", "website", "industry", "address_line1", "address_line2", "city", "district", "state", "postal_code", "country", "gstin", "notes", "source", "status", "status_before_archive", "archived_at", "assigned_to", "created_by", "created_at", "updated_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_customer_number_unique` ON `customers` (`customer_number`);--> statement-breakpoint
CREATE INDEX `customers_phone_normalized_idx` ON `customers` (`phone_normalized`);--> statement-breakpoint
CREATE INDEX `customers_email_normalized_idx` ON `customers` (`email_normalized`);--> statement-breakpoint
CREATE INDEX `customers_business_name_normalized_idx` ON `customers` (`business_name_normalized`);--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`status`);--> statement-breakpoint
CREATE INDEX `customers_type_idx` ON `customers` (`type`);--> statement-breakpoint
CREATE INDEX `customers_assigned_to_idx` ON `customers` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `customers_created_by_idx` ON `customers` (`created_by`);--> statement-breakpoint
CREATE INDEX `customers_created_at_idx` ON `customers` (`created_at`);--> statement-breakpoint
CREATE INDEX `customers_updated_at_idx` ON `customers` (`updated_at`);--> statement-breakpoint
CREATE INDEX `customers_archived_at_idx` ON `customers` (`archived_at`);--> statement-breakpoint
CREATE INDEX `customers_city_idx` ON `customers` (`city`);--> statement-breakpoint
CREATE INDEX `customers_state_idx` ON `customers` (`state`);--> statement-breakpoint
CREATE INDEX `customers_gstin_idx` ON `customers` (`gstin`);