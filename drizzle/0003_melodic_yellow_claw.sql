CREATE TABLE `worker_agency_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerId` int NOT NULL,
	`agencyId` int NOT NULL,
	`status` enum('PENDING','ACTIVE','REJECTED','INACTIVE') NOT NULL DEFAULT 'PENDING',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worker_agency_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `worker_agency_memberships_unique` UNIQUE(`workerId`,`agencyId`)
);
--> statement-breakpoint
ALTER TABLE `worker_agency_memberships` ADD CONSTRAINT `worker_agency_memberships_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_agency_memberships` ADD CONSTRAINT `worker_agency_memberships_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `worker_agency_memberships_agency_status_idx` ON `worker_agency_memberships` (`agencyId`,`status`);--> statement-breakpoint
CREATE INDEX `worker_agency_memberships_worker_status_idx` ON `worker_agency_memberships` (`workerId`,`status`);