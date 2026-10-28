CREATE TABLE `manager_worker_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`workerId` int NOT NULL,
	`agencyId` int NOT NULL,
	`managerUserId` int NOT NULL,
	`attendanceStatus` enum('NORMAL','LATE') NOT NULL,
	`skillScore` int NOT NULL,
	`safetyStatus` enum('PASS','FAIL') NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manager_worker_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_worker_reviews_assignment_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
CREATE TABLE `no_show_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`workerId` int NOT NULL,
	`agencyId` int NOT NULL,
	`managerUserId` int NOT NULL,
	`reportedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `no_show_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `no_show_reports_assignment_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
CREATE TABLE `worker_agency_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`workerId` int NOT NULL,
	`agencyId` int NOT NULL,
	`workerUserId` int NOT NULL,
	`wageStatus` enum('NORMAL','LATE','UNPAID') NOT NULL,
	`siteSafetyScore` int NOT NULL,
	`facilitiesScore` int NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `worker_agency_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `worker_agency_reviews_assignment_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
ALTER TABLE `job_assignments` MODIFY COLUMN `status` enum('PENDING','ASSIGNED','REJECTED','CANCELED','COMPLETED','NO_SHOW') NOT NULL DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE `manager_worker_reviews` ADD CONSTRAINT `manager_worker_reviews_assignmentId_job_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `job_assignments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manager_worker_reviews` ADD CONSTRAINT `manager_worker_reviews_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manager_worker_reviews` ADD CONSTRAINT `manager_worker_reviews_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manager_worker_reviews` ADD CONSTRAINT `manager_worker_reviews_managerUserId_users_id_fk` FOREIGN KEY (`managerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `no_show_reports` ADD CONSTRAINT `no_show_reports_assignmentId_job_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `job_assignments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `no_show_reports` ADD CONSTRAINT `no_show_reports_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `no_show_reports` ADD CONSTRAINT `no_show_reports_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `no_show_reports` ADD CONSTRAINT `no_show_reports_managerUserId_users_id_fk` FOREIGN KEY (`managerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_agency_reviews` ADD CONSTRAINT `worker_agency_reviews_assignmentId_job_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `job_assignments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_agency_reviews` ADD CONSTRAINT `worker_agency_reviews_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_agency_reviews` ADD CONSTRAINT `worker_agency_reviews_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_agency_reviews` ADD CONSTRAINT `worker_agency_reviews_workerUserId_users_id_fk` FOREIGN KEY (`workerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `manager_worker_reviews_worker_submitted_idx` ON `manager_worker_reviews` (`workerId`,`submittedAt`);--> statement-breakpoint
CREATE INDEX `manager_worker_reviews_agency_submitted_idx` ON `manager_worker_reviews` (`agencyId`,`submittedAt`);--> statement-breakpoint
CREATE INDEX `no_show_reports_worker_reported_idx` ON `no_show_reports` (`workerId`,`reportedAt`);--> statement-breakpoint
CREATE INDEX `no_show_reports_agency_reported_idx` ON `no_show_reports` (`agencyId`,`reportedAt`);--> statement-breakpoint
CREATE INDEX `worker_agency_reviews_agency_submitted_idx` ON `worker_agency_reviews` (`agencyId`,`submittedAt`);--> statement-breakpoint
CREATE INDEX `worker_agency_reviews_worker_submitted_idx` ON `worker_agency_reviews` (`workerId`,`submittedAt`);