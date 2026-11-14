ALTER TABLE `expenses` ADD `payment_method` text DEFAULT 'Others' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `linked_commitment_id` integer REFERENCES commitments(id);--> statement-breakpoint
CREATE INDEX `expenses_linked_commitment_id_idx` ON `expenses` (`linked_commitment_id`);