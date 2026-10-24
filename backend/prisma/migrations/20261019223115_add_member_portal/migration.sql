-- AlterTable
ALTER TABLE `payment` MODIFY `method` ENUM('CASH', 'EFT', 'OTHER', 'ONLINE') NOT NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('ADMIN', 'VIEWER', 'MEMBER') NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE `HouseholdMember` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `householdId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,

    UNIQUE INDEX `HouseholdMember_userId_key`(`userId`),
    INDEX `HouseholdMember_householdId_idx`(`householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NOT NULL,
    `obligationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paymentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PaymentAttempt_reference_key`(`reference`),
    UNIQUE INDEX `PaymentAttempt_paymentId_key`(`paymentId`),
    INDEX `PaymentAttempt_obligationId_idx`(`obligationId`),
    INDEX `PaymentAttempt_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `HouseholdMember` ADD CONSTRAINT `HouseholdMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HouseholdMember` ADD CONSTRAINT `HouseholdMember_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_obligationId_fkey` FOREIGN KEY (`obligationId`) REFERENCES `ContributionObligation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
