/*
  Warnings:

  - You are about to drop the column `formationId` on the `Inscription` table. All the data in the column will be lost.
  - Added the required column `formation` to the `Inscription` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'VALIDATED');

-- DropForeignKey
ALTER TABLE "Inscription" DROP CONSTRAINT "Inscription_formationId_fkey";

-- AlterTable
ALTER TABLE "Inscription" DROP COLUMN "formationId",
ADD COLUMN     "code" TEXT,
ADD COLUMN     "formation" TEXT NOT NULL,
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'PENDING';
