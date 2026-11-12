-- Nothing has written scorecard results before the ingestor's check engine, so
-- any row pointing at a service that does not exist is leftover test data. It
-- has to go before the constraint can be added.
DELETE FROM "scorecard_results"
WHERE "service_id" NOT IN (SELECT "id" FROM "services");

-- AddForeignKey
ALTER TABLE "scorecard_results" ADD CONSTRAINT "scorecard_results_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
