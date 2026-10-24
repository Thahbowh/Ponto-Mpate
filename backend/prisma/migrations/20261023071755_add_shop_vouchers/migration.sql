/*
  Warnings:

  - A unique constraint covering the columns `[payReference]` on the table `ContributionObligation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `contributionobligation` ADD COLUMN `payReference` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payment` MODIFY `method` ENUM('CASH', 'EFT', 'OTHER', 'ONLINE', 'VOUCHER') NOT NULL;

-- CreateTable
CREATE TABLE `VoucherTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `providerReference` VARCHAR(191) NOT NULL,
    `obligationId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NULL,
    `status` ENUM('CONFIRMED', 'REJECTED') NOT NULL,
    `grossAmount` DECIMAL(10, 2) NOT NULL,
    `providerFee` DECIMAL(10, 2) NOT NULL,
    `netAmount` DECIMAL(10, 2) NOT NULL,
    `settlementStatus` ENUM('AWAITING_SETTLEMENT', 'SETTLED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'AWAITING_SETTLEMENT',
    `settledAt` DATETIME(3) NULL,
    `settlementBatch` VARCHAR(191) NULL,
    `note` VARCHAR(300) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VoucherTransaction_providerReference_key`(`providerReference`),
    UNIQUE INDEX `VoucherTransaction_paymentId_key`(`paymentId`),
    INDEX `VoucherTransaction_obligationId_idx`(`obligationId`),
    INDEX `VoucherTransaction_settlementStatus_idx`(`settlementStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ContributionObligation_payReference_key` ON `ContributionObligation`(`payReference`);

-- AddForeignKey
ALTER TABLE `VoucherTransaction` ADD CONSTRAINT `VoucherTransaction_obligationId_fkey` FOREIGN KEY (`obligationId`) REFERENCES `ContributionObligation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherTransaction` ADD CONSTRAINT `VoucherTransaction_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
