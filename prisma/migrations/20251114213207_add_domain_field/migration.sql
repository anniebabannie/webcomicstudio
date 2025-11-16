/*
  Warnings:

  - A unique constraint covering the columns `[domain]` on the table `Comic` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Comic" ADD COLUMN     "domain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Comic_domain_key" ON "Comic"("domain");
