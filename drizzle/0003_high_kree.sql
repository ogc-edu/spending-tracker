CREATE TABLE `credit_bill_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`bill_year` integer NOT NULL,
	`bill_month` integer NOT NULL,
	`amount_sen` integer NOT NULL,
	`paid_date` text NOT NULL,
	`from_account_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `credit_bill_payments_user_id_idx` ON `credit_bill_payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_bill_payments_account_id_idx` ON `credit_bill_payments` (`account_id`);--> statement-breakpoint
CREATE TABLE `expense_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expense_id` text NOT NULL,
	`months` integer NOT NULL,
	`monthly_rate_bp` integer NOT NULL,
	`principal_sen` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_installments_expense_id_unique` ON `expense_installments` (`expense_id`);--> statement-breakpoint
CREATE INDEX `expense_installments_user_id_idx` ON `expense_installments` (`user_id`);--> statement-breakpoint
CREATE INDEX `expense_installments_expense_id_idx` ON `expense_installments` (`expense_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `statement_day` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `due_day` integer;--> statement-breakpoint
ALTER TABLE `accounts` ADD `opening_owed_sen` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `theme_mode` text DEFAULT 'dark' NOT NULL;