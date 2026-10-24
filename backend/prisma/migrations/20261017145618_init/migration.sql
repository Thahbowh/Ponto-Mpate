-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'VIEWER') NOT NULL DEFAULT 'ADMIN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `schemeName` VARCHAR(191) NOT NULL,
    `defaultContributionAmount` DECIMAL(10, 2) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ward` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Ward_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WardNeighbour` (
    `wardId` VARCHAR(191) NOT NULL,
    `neighbourId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`wardId`, `neighbourId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Household` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `householdName` VARCHAR(191) NOT NULL,
    `wardId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Household_reference_key`(`reference`),
    INDEX `Household_wardId_idx`(`wardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FuneralEvent` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `eventDate` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `contributionAmount` DECIMAL(10, 2) NOT NULL,
    `homeWardId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FuneralEvent_reference_key`(`reference`),
    INDEX `FuneralEvent_homeWardId_idx`(`homeWardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventEligibleWard` (
    `eventId` VARCHAR(191) NOT NULL,
    `wardId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`eventId`, `wardId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContributionObligation` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `householdId` VARCHAR(191) NOT NULL,
    `amountDue` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'UNDER_REVIEW') NOT NULL DEFAULT 'UNPAID',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContributionObligation_householdId_idx`(`householdId`),
    UNIQUE INDEX `ContributionObligation_eventId_householdId_key`(`eventId`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `obligationId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('CASH', 'EFT', 'OTHER') NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recordedById` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Payment_obligationId_idx`(`obligationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Receipt` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Receipt_reference_key`(`reference`),
    UNIQUE INDEX `Receipt_paymentId_key`(`paymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WardNeighbour` ADD CONSTRAINT `WardNeighbour_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `Ward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WardNeighbour` ADD CONSTRAINT `WardNeighbour_neighbourId_fkey` FOREIGN KEY (`neighbourId`) REFERENCES `Ward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Household` ADD CONSTRAINT `Household_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `Ward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FuneralEvent` ADD CONSTRAINT `FuneralEvent_homeWardId_fkey` FOREIGN KEY (`homeWardId`) REFERENCES `Ward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FuneralEvent` ADD CONSTRAINT `FuneralEvent_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventEligibleWard` ADD CONSTRAINT `EventEligibleWard_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `FuneralEvent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventEligibleWard` ADD CONSTRAINT `EventEligibleWard_wardId_fkey` FOREIGN KEY (`wardId`) REFERENCES `Ward`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContributionObligation` ADD CONSTRAINT `ContributionObligation_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `FuneralEvent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContributionObligation` ADD CONSTRAINT `ContributionObligation_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_obligationId_fkey` FOREIGN KEY (`obligationId`) REFERENCES `ContributionObligation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
