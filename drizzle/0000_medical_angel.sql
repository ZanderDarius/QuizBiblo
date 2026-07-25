CREATE TABLE `players` (
	`room_code` text NOT NULL,
	`session` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`joined_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_session` text NOT NULL,
	`started` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`winner_session` text,
	`winner_name` text
);
