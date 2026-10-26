-- AlterTable
ALTER TABLE `funeralevent` ADD COLUMN `bereavedHouseholdId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `FuneralEvent` ADD CONSTRAINT `FuneralEvent_bereavedHouseholdId_fkey` FOREIGN KEY (`bereavedHouseholdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
