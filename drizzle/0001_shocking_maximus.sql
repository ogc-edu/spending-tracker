CREATE TABLE `payroll_allocations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`amount_sen` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payroll_allocations_user_id_idx` ON `payroll_allocations` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_allocations_user_account_unique` ON `payroll_allocations` (`user_id`,`account_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `payroll_last_run_at` integer;