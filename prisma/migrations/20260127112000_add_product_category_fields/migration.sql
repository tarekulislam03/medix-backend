-- AlterTable
ALTER TABLE "products" ADD COLUMN     "composition" TEXT,
ADD COLUMN     "qtyInMl" DECIMAL(10,2),
ADD COLUMN     "tabletsPerStrip" INTEGER;
