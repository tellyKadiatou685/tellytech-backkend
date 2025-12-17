-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COACH';

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "formation" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "videoUrl" TEXT,
    "pdfUrl" TEXT,
    "readMoreUrl" TEXT,
    "moduleId" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" SERIAL NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "inscriptionId" INTEGER NOT NULL,
    "link" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_lessonId_key" ON "Assignment"("lessonId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "Inscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
