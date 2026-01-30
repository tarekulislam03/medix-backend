/*
  Warnings:

  - You are about to drop the column `storeId` on the `stores` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "stores" DROP CONSTRAINT "stores_storeId_fkey";

-- DropIndex
DROP INDEX "stores_storeId_idx";

-- AlterTable
ALTER TABLE "stores" DROP COLUMN "storeId";
