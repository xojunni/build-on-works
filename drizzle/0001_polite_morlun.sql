CREATE TABLE `agencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`region` varchar(100) NOT NULL,
	`address` text,
	`phone` varchar(20),
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `agencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerId` int NOT NULL,
	`jobId` int NOT NULL,
	`workDate` date NOT NULL,
	`checkIn` timestamp,
	`checkOut` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `attendance_worker_job_date_unique` UNIQUE(`workerId`,`jobId`,`workDate`)
);
--> statement-breakpoint
CREATE TABLE `job_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`workerId` int NOT NULL,
	`status` enum('PENDING','ASSIGNED','REJECTED','CANCELED','COMPLETED') NOT NULL DEFAULT 'PENDING',
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`completedAt` timestamp,
	`canceledAt` timestamp,
	CONSTRAINT `job_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_assignments_job_worker_unique` UNIQUE(`jobId`,`workerId`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agencyId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`region` varchar(100) NOT NULL,
	`address` text,
	`jobDate` date NOT NULL,
	`startTime` varchar(10),
	`endTime` varchar(10),
	`requiredWorkers` int NOT NULL,
	`dailyWage` int NOT NULL,
	`status` enum('RECRUITING','CLOSED','CANCELED') NOT NULL DEFAULT 'RECRUITING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerId` int NOT NULL,
	`jobId` int NOT NULL,
	`agencyId` int NOT NULL,
	`amount` int NOT NULL,
	`description` text,
	`status` enum('PENDING','PAID','CANCELED') NOT NULL DEFAULT 'PENDING',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_worker_job_unique` UNIQUE(`workerId`,`jobId`)
);
--> statement-breakpoint
CREATE TABLE `worker_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agencyId` int,
	`birthDate` date,
	`certificate` varchar(200),
	`phone` varchar(20),
	`bankAccount` varchar(100),
	`bankName` varchar(50),
	`status` enum('UNAFFILIATED','PENDING','ACTIVE','REJECTED','INACTIVE') NOT NULL DEFAULT 'UNAFFILIATED',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `worker_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `worker_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `loginMethod` varchar(64) DEFAULT 'manus-oauth';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `accountRole` enum('MANAGER','WORKER');--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phone_unique` UNIQUE(`phone`);--> statement-breakpoint
ALTER TABLE `agencies` ADD CONSTRAINT `agencies_managerId_users_id_fk` FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD CONSTRAINT `attendance_records_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_assignments` ADD CONSTRAINT `job_assignments_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_assignments` ADD CONSTRAINT `job_assignments_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_workerId_worker_profiles_id_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_profiles` ADD CONSTRAINT `worker_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_profiles` ADD CONSTRAINT `worker_profiles_agencyId_agencies_id_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agencies_manager_idx` ON `agencies` (`managerId`);--> statement-breakpoint
CREATE INDEX `agencies_region_idx` ON `agencies` (`region`);--> statement-breakpoint
CREATE INDEX `attendance_worker_idx` ON `attendance_records` (`workerId`,`workDate`);--> statement-breakpoint
CREATE INDEX `job_assignments_worker_status_idx` ON `job_assignments` (`workerId`,`status`);--> statement-breakpoint
CREATE INDEX `job_assignments_job_status_idx` ON `job_assignments` (`jobId`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_agency_status_date_idx` ON `jobs` (`agencyId`,`status`,`jobDate`);--> statement-breakpoint
CREATE INDEX `jobs_region_status_idx` ON `jobs` (`region`,`status`);--> statement-breakpoint
CREATE INDEX `payment_worker_status_idx` ON `payment_records` (`workerId`,`status`);--> statement-breakpoint
CREATE INDEX `payment_agency_status_idx` ON `payment_records` (`agencyId`,`status`);--> statement-breakpoint
CREATE INDEX `worker_profiles_agency_status_idx` ON `worker_profiles` (`agencyId`,`status`);