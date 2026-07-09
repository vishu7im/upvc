-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXECUTED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "department" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "account_deletion_request" (
    "id" TEXT NOT NULL,
    "targetId" TEXT,
    "requesterId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "account_deletion_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_deletion_request_targetId_status_idx" ON "account_deletion_request"("targetId", "status");

-- AddForeignKey
ALTER TABLE "account_deletion_request" ADD CONSTRAINT "account_deletion_request_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletion_request" ADD CONSTRAINT "account_deletion_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
