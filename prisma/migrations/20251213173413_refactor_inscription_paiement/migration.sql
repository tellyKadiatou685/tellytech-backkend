/*
  Warnings:

  - You are about to drop the column `montant` on the `Inscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Inscription" DROP COLUMN "montant",
ADD COLUMN     "mensualite" INTEGER,
ADD COLUMN     "montantInscription" INTEGER NOT NULL DEFAULT 30000,
ALTER COLUMN "nombreMois" DROP NOT NULL,
ALTER COLUMN "nombreMois" DROP DEFAULT;
