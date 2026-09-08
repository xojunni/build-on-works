ALTER TABLE `attendance_records` ADD `checkInLatitude` double;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkInLongitude` double;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkInAccuracyMeters` int;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkInDistanceMeters` int;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkOutLatitude` double;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkOutLongitude` double;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkOutAccuracyMeters` int;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `checkOutDistanceMeters` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `siteLatitude` double;--> statement-breakpoint
ALTER TABLE `jobs` ADD `siteLongitude` double;--> statement-breakpoint
ALTER TABLE `jobs` ADD `geofenceRadiusMeters` int DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `siteGeocodedAt` timestamp;