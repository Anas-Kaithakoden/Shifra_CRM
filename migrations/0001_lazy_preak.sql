CREATE TABLE `lead_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`user_id` text,
	`activity_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`previous_stage` text,
	`new_stage` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "lead_activities_type_check" CHECK("lead_activities"."activity_type" in ('lead_created', 'call', 'whatsapp', 'email', 'meeting', 'note', 'stage_changed', 'assignment_changed', 'contact_status_changed', 'follow_up_scheduled', 'follow_up_rescheduled', 'follow_up_completed', 'follow_up_cancelled', 'lead_won', 'lead_lost', 'lead_reopened')),
	CONSTRAINT "lead_activities_previous_stage_check" CHECK("lead_activities"."previous_stage" is null or "lead_activities"."previous_stage" in ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost')),
	CONSTRAINT "lead_activities_new_stage_check" CHECK("lead_activities"."new_stage" is null or "lead_activities"."new_stage" in ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'))
);
--> statement-breakpoint
CREATE INDEX `lead_activities_lead_id_idx` ON `lead_activities` (`lead_id`);--> statement-breakpoint
CREATE INDEX `lead_activities_user_id_idx` ON `lead_activities` (`user_id`);--> statement-breakpoint
CREATE INDEX `lead_activities_created_at_idx` ON `lead_activities` (`created_at`);--> statement-breakpoint
CREATE INDEX `lead_activities_type_idx` ON `lead_activities` (`activity_type`);--> statement-breakpoint
CREATE INDEX `lead_activities_lead_created_idx` ON `lead_activities` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_follow_ups` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`assigned_to` text,
	`title` text NOT NULL,
	`notes` text,
	`scheduled_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "lead_follow_ups_status_check" CHECK("lead_follow_ups"."status" in ('pending', 'completed', 'cancelled')),
	CONSTRAINT "lead_follow_ups_title_length_check" CHECK(length("lead_follow_ups"."title") between 1 and 200),
	CONSTRAINT "lead_follow_ups_completed_at_check" CHECK("lead_follow_ups"."status" != 'completed' or "lead_follow_ups"."completed_at" is not null)
);
--> statement-breakpoint
CREATE INDEX `lead_follow_ups_lead_id_idx` ON `lead_follow_ups` (`lead_id`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_assigned_to_idx` ON `lead_follow_ups` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_scheduled_at_idx` ON `lead_follow_ups` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_status_idx` ON `lead_follow_ups` (`status`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_status_scheduled_idx` ON `lead_follow_ups` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `lead_follow_ups_created_by_idx` ON `lead_follow_ups` (`created_by`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_number` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`phone_normalized` text NOT NULL,
	`email` text,
	`email_normalized` text,
	`business_name` text,
	`location` text,
	`service_interest` text,
	`service_category` text,
	`source` text NOT NULL,
	`pipeline_stage` text DEFAULT 'new' NOT NULL,
	`contact_status` text DEFAULT 'not_contacted' NOT NULL,
	`assigned_to` text,
	`estimated_value` real,
	`priority` text DEFAULT 'medium' NOT NULL,
	`description` text,
	`lost_reason` text,
	`next_follow_up_at` text,
	`last_contacted_at` text,
	`converted_at` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "leads_pipeline_stage_check" CHECK("leads"."pipeline_stage" in ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost')),
	CONSTRAINT "leads_contact_status_check" CHECK("leads"."contact_status" in ('not_contacted', 'attempted', 'contacted')),
	CONSTRAINT "leads_priority_check" CHECK("leads"."priority" in ('low', 'medium', 'high')),
	CONSTRAINT "leads_source_check" CHECK("leads"."source" in ('Facebook Ads', 'Instagram Ads', 'WhatsApp', 'Website', 'Phone Call', 'Referral', 'Walk-in', 'Other')),
	CONSTRAINT "leads_estimated_value_check" CHECK("leads"."estimated_value" is null or "leads"."estimated_value" >= 0),
	CONSTRAINT "leads_name_length_check" CHECK(length("leads"."name") between 1 and 160),
	CONSTRAINT "leads_phone_length_check" CHECK(length("leads"."phone_normalized") between 5 and 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_lead_number_unique` ON `leads` (`lead_number`);--> statement-breakpoint
CREATE INDEX `leads_phone_normalized_idx` ON `leads` (`phone_normalized`);--> statement-breakpoint
CREATE INDEX `leads_email_normalized_idx` ON `leads` (`email_normalized`);--> statement-breakpoint
CREATE INDEX `leads_pipeline_stage_idx` ON `leads` (`pipeline_stage`);--> statement-breakpoint
CREATE INDEX `leads_contact_status_idx` ON `leads` (`contact_status`);--> statement-breakpoint
CREATE INDEX `leads_assigned_to_idx` ON `leads` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `leads_next_follow_up_at_idx` ON `leads` (`next_follow_up_at`);--> statement-breakpoint
CREATE INDEX `leads_created_at_idx` ON `leads` (`created_at`);--> statement-breakpoint
CREATE INDEX `leads_source_idx` ON `leads` (`source`);--> statement-breakpoint
CREATE INDEX `leads_service_interest_idx` ON `leads` (`service_interest`);--> statement-breakpoint
CREATE INDEX `leads_priority_idx` ON `leads` (`priority`);--> statement-breakpoint
CREATE INDEX `leads_deleted_at_idx` ON `leads` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `leads_assigned_stage_idx` ON `leads` (`assigned_to`,`pipeline_stage`);