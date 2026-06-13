CREATE TABLE `scheduled_job_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobName` varchar(128) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`duration` int,
	`result` json,
	`error` text,
	`itemsProcessed` int DEFAULT 0,
	CONSTRAINT `scheduled_job_runs_id` PRIMARY KEY(`id`)
);
