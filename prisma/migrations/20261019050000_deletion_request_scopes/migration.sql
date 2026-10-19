-- CreateEnum
CREATE TYPE "DataRequestScope" AS ENUM ('FARM', 'PERSON');

-- AlterTable
ALTER TABLE "DataRequest" ADD COLUMN     "scope" "DataRequestScope",
ADD COLUMN     "subjectUserId" TEXT;

-- AddForeignKey
ALTER TABLE "DataRequest" ADD CONSTRAINT "DataRequest_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
