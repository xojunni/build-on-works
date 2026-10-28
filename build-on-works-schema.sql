-- Build On Works 전체 데이터베이스 스키마
-- MySQL / TiDB Cloud SQL Editor용
-- 주의: 기존 데이터가 있는 DB에서는 DROP TABLE을 사용하지 마세요.
-- 새 DB 또는 비어 있는 DB에서 실행하는 것을 권장합니다.

-- 1) 사용할 데이터베이스 선택
USE `test`;

-- 2) 기본 사용자 테이블
-- Manus 템플릿의 users 테이블이 이미 있으면 이 문장은 그대로 건너뜁니다.
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `phone` varchar(20),
  `passwordHash` varchar(255),
  `accountRole` enum('MANAGER','WORKER'),
  `loginMethod` varchar(64) DEFAULT 'manus-oauth',
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`),
  UNIQUE KEY `users_phone_unique` (`phone`)
);

-- 3) 인력소
CREATE TABLE IF NOT EXISTS `agencies` (
  `id` int AUTO_INCREMENT NOT NULL,
  `managerId` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `region` varchar(100) NOT NULL,
  `address` text,
  `phone` varchar(20),
  `description` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `agencies_manager_idx` (`managerId`),
  KEY `agencies_region_idx` (`region`),
  CONSTRAINT `agencies_manager_fk` FOREIGN KEY (`managerId`) REFERENCES `users` (`id`)
);

-- 4) 인부 기본 프로필
CREATE TABLE IF NOT EXISTS `worker_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `agencyId` int,
  `birthDate` date,
  `certificate` varchar(200),
  `phone` varchar(20),
  `bankAccount` varchar(100),
  `bankName` varchar(50),
  `status` enum('UNAFFILIATED','PENDING','ACTIVE','REJECTED','INACTIVE') NOT NULL DEFAULT 'UNAFFILIATED',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worker_profiles_user_unique` (`userId`),
  KEY `worker_profiles_agency_status_idx` (`agencyId`,`status`),
  CONSTRAINT `worker_profiles_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`),
  CONSTRAINT `worker_profiles_agency_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`)
);

-- 5) 인부-인력소 다중 소속
CREATE TABLE IF NOT EXISTS `worker_agency_memberships` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workerId` int NOT NULL,
  `agencyId` int NOT NULL,
  `status` enum('PENDING','ACTIVE','REJECTED','INACTIVE') NOT NULL DEFAULT 'PENDING',
  `requestedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `respondedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worker_agency_memberships_unique` (`workerId`,`agencyId`),
  KEY `worker_agency_memberships_agency_status_idx` (`agencyId`,`status`),
  KEY `worker_agency_memberships_worker_status_idx` (`workerId`,`status`),
  CONSTRAINT `worker_agency_memberships_worker_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles` (`id`),
  CONSTRAINT `worker_agency_memberships_agency_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`)
);

-- 6) 일감
CREATE TABLE IF NOT EXISTS `jobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `agencyId` int NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text,
  `region` varchar(100) NOT NULL,
  `address` text,
  `siteLatitude` double,
  `siteLongitude` double,
  `geofenceRadiusMeters` int NOT NULL DEFAULT 150,
  `siteGeocodedAt` timestamp NULL,
  `jobDate` date NOT NULL,
  `startTime` varchar(10),
  `endTime` varchar(10),
  `requiredWorkers` int NOT NULL,
  `dailyWage` int NOT NULL,
  `status` enum('RECRUITING','CLOSED','CANCELED') NOT NULL DEFAULT 'RECRUITING',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `jobs_agency_status_date_idx` (`agencyId`,`status`,`jobDate`),
  KEY `jobs_region_status_idx` (`region`,`status`),
  CONSTRAINT `jobs_agency_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`)
);

-- 7) 일감 신청 및 배정
CREATE TABLE IF NOT EXISTS `job_assignments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `jobId` int NOT NULL,
  `workerId` int NOT NULL,
  `status` enum('PENDING','ASSIGNED','REJECTED','CANCELED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  `requestedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `respondedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `canceledAt` timestamp NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `job_assignments_job_worker_unique` (`jobId`,`workerId`),
  KEY `job_assignments_worker_status_idx` (`workerId`,`status`),
  KEY `job_assignments_job_status_idx` (`jobId`,`status`),
  CONSTRAINT `job_assignments_job_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs` (`id`),
  CONSTRAINT `job_assignments_worker_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles` (`id`)
);

-- 8) GPS 기반 출퇴근 기록
CREATE TABLE IF NOT EXISTS `attendance_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workerId` int NOT NULL,
  `jobId` int NOT NULL,
  `workDate` date NOT NULL,
  `checkIn` timestamp NULL,
  `checkOut` timestamp NULL,
  `checkInLatitude` double,
  `checkInLongitude` double,
  `checkInAccuracyMeters` int,
  `checkInDistanceMeters` int,
  `checkOutLatitude` double,
  `checkOutLongitude` double,
  `checkOutAccuracyMeters` int,
  `checkOutDistanceMeters` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attendance_worker_job_date_unique` (`workerId`,`jobId`,`workDate`),
  KEY `attendance_worker_idx` (`workerId`,`workDate`),
  CONSTRAINT `attendance_records_worker_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles` (`id`),
  CONSTRAINT `attendance_records_job_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs` (`id`)
);

-- 9) 급여 지급 기록
CREATE TABLE IF NOT EXISTS `payment_records` (
  `id` int AUTO_INCREMENT NOT NULL,
  `workerId` int NOT NULL,
  `jobId` int NOT NULL,
  `agencyId` int NOT NULL,
  `amount` int NOT NULL,
  `description` text,
  `status` enum('PENDING','PAID','CANCELED') NOT NULL DEFAULT 'PENDING',
  `paidAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_worker_job_unique` (`workerId`,`jobId`),
  KEY `payment_worker_status_idx` (`workerId`,`status`),
  KEY `payment_agency_status_idx` (`agencyId`,`status`),
  CONSTRAINT `payment_records_worker_fk` FOREIGN KEY (`workerId`) REFERENCES `worker_profiles` (`id`),
  CONSTRAINT `payment_records_job_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs` (`id`),
  CONSTRAINT `payment_records_agency_fk` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`)
);

-- 생성 결과 확인
SHOW TABLES;

-- 아래 조회문으로 현재 테이블 구조를 확인할 수 있습니다.
-- DESCRIBE users;
-- DESCRIBE agencies;
-- DESCRIBE worker_profiles;
-- DESCRIBE worker_agency_memberships;
-- DESCRIBE jobs;
-- DESCRIBE job_assignments;
-- DESCRIBE attendance_records;
-- DESCRIBE payment_records;
