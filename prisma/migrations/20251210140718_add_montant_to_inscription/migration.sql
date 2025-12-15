/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Inscription` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `Inscription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StatusPaiement" AS ENUM ('EN_ATTENTE', 'VALIDE', 'REJETE');

-- AlterTable
ALTER TABLE "Formation" ADD COLUMN     "mensualite" INTEGER,
ADD COLUMN     "nombreMois" INTEGER;

-- AlterTable
ALTER TABLE "Inscription" ADD COLUMN     "nombreMois" INTEGER NOT NULL DEFAULT 6;

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "status" "StatusPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
    "dateValidation" TIMESTAMP(3),
    "recuUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_email_key" ON "Inscription"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Inscription_code_key" ON "Inscription"("code");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
