CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance_sen` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category_id` integer,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`amount_sen` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `budgets_user_id_idx` ON `budgets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_user_category_month_year_unique` ON `budgets` (`user_id`,`category_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`type` text DEFAULT 'expense' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commitment_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`commitment_id` integer NOT NULL,
	`amount_sen` integer NOT NULL,
	`due_date` text NOT NULL,
	`paid_date` text,
	`status` text DEFAULT 'paid' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commitment_id`) REFERENCES `commitments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `commitment_payments_user_id_idx` ON `commitment_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `commitment_payments_commitment_id_idx` ON `commitment_payments` (`commitment_id`);--> statement-breakpoint
CREATE TABLE `commitments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`total_sen` integer,
	`remaining_sen` integer NOT NULL,
	`payment_sen` integer NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `commitments_user_id_idx` ON `commitments` (`user_id`);--> statement-breakpoint
CREATE INDEX `commitments_status_idx` ON `commitments` (`status`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount_sen` integer NOT NULL,
	`category_id` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`account_id` integer,
	`commitment_payment_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commitment_payment_id`) REFERENCES `commitment_payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_commitment_payment_id_unique` ON `expenses` (`commitment_payment_id`);--> statement-breakpoint
CREATE INDEX `expenses_user_id_idx` ON `expenses` (`user_id`);--> statement-breakpoint
CREATE INDEX `expenses_date_idx` ON `expenses` (`date`);--> statement-breakpoint
CREATE INDEX `expenses_category_id_idx` ON `expenses` (`category_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`safety_buffer_sen` integer DEFAULT 30000 NOT NULL,
	`ai_active_provider` text,
	`ai_model_gemini` text,
	`ai_model_deepseek` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text COLLATE nocase NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);