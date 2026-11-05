CREATE TABLE `customer_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`user_id` text,
	`activity_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`metadata` text,
	`lead_id` text,
	`contact_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contact_id`) REFERENCES `customer_contacts`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "customer_activities_type_check" CHECK("customer_activities"."activity_type" in ('customer_created', 'customer_updated', 'status_changed', 'assignment_changed', 'contact_added', 'contact_updated', 'contact_removed', 'primary_contact_changed', 'note_added', 'interaction_logged', 'call', 'whatsapp', 'email', 'meeting', 'lead_linked', 'lead_converted', 'customer_archived', 'customer_restored')),
	CONSTRAINT "customer_activities_metadata_json_check" CHECK("customer_activities"."metadata" is null or json_valid("customer_activities"."metadata")),
	CONSTRAINT "customer_activities_title_length_check" CHECK(length("customer_activities"."title") between 1 and 200)
);
--> statement-breakpoint
CREATE INDEX `customer_activities_customer_id_idx` ON `customer_activities` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_activities_user_id_idx` ON `customer_activities` (`user_id`);--> statement-breakpoint
CREATE INDEX `customer_activities_type_idx` ON `customer_activities` (`activity_type`);--> statement-breakpoint
CREATE INDEX `customer_activities_created_at_idx` ON `customer_activities` (`created_at`);--> statement-breakpoint
CREATE INDEX `customer_activities_customer_created_idx` ON `customer_activities` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `customer_activities_lead_id_idx` ON `customer_activities` (`lead_id`);--> statement-breakpoint
CREATE TABLE `customer_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`full_name` text NOT NULL,
	`job_title` text,
	`phone` text,
	`phone_normalized` text,
	`email` text,
	`email_normalized` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "customer_contacts_full_name_length_check" CHECK(length("customer_contacts"."full_name") between 1 and 160),
	CONSTRAINT "customer_contacts_email_lowercase_check" CHECK("customer_contacts"."email" is null or "customer_contacts"."email" = lower("customer_contacts"."email")),
	CONSTRAINT "customer_contacts_phone_length_check" CHECK("customer_contacts"."phone_normalized" is null or length("customer_contacts"."phone_normalized") between 5 and 20)
);
--> statement-breakpoint
CREATE INDEX `customer_contacts_customer_id_idx` ON `customer_contacts` (`customer_id`);--> statement-breakpoint
CREATE INDEX `customer_contacts_phone_normalized_idx` ON `customer_contacts` (`phone_normalized`);--> statement-breakpoint
CREATE INDEX `customer_contacts_email_normalized_idx` ON `customer_contacts` (`email_normalized`);--> statement-breakpoint
CREATE INDEX `customer_contacts_primary_idx` ON `customer_contacts` (`customer_id`,`is_primary`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_contacts_primary_unique` ON `customer_contacts` (`customer_id`) WHERE "customer_contacts"."is_primary" = 1;--> statement-breakpoint
CREATE TABLE `customer_number_sequence` (
	`key` text PRIMARY KEY NOT NULL,
	`last_value` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `customer_number_sequence` (`key`, `last_value`) VALUES ('customer', 0);
--> statement-breakpoint
CREATE TABLE `customers` (
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
	`address_line1` text,
	`address_line2` text,
	`city` text,
	`state` text,
	`postal_code` text,
	`country` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`status_before_archive` text,
	`archived_at` text,
	`assigned_to` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "customers_type_check" CHECK("customers"."type" in ('individual', 'business')),
	CONSTRAINT "customers_status_check" CHECK("customers"."status" in ('active', 'inactive', 'archived')),
	CONSTRAINT "customers_name_length_check" CHECK(length("customers"."name") between 1 and 160),
	CONSTRAINT "customers_phone_length_check" CHECK(length("customers"."phone_normalized") between 5 and 20),
	CONSTRAINT "customers_email_lowercase_check" CHECK("customers"."email" is null or "customers"."email" = lower("customers"."email")),
	CONSTRAINT "customers_archived_at_check" CHECK(("customers"."status" = 'archived' and "customers"."archived_at" is not null) or ("customers"."status" != 'archived' and "customers"."archived_at" is null))
);
--> statement-breakpoint
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
ALTER TABLE `leads` ADD `customer_id` text REFERENCES customers(id);--> statement-breakpoint
ALTER TABLE `leads` ADD `converted_to_customer_at` text;--> statement-breakpoint
CREATE INDEX `leads_customer_id_idx` ON `leads` (`customer_id`);--> statement-breakpoint
CREATE INDEX `leads_converted_to_customer_at_idx` ON `leads` (`converted_to_customer_at`);