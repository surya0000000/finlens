import { Router } from "express";
import { z } from "zod";

import { answerAdvisorQuestion } from "../services/advisorService";
import { HttpError } from "../utils/httpError";

const advisorRoutes = Router();

const querySchema = z.object({
  question: z.string().min(3).max(2000),
});

advisorRoutes.post("/query", async (request, response) => {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "Unauthorized.");
  }

  const payload = querySchema.parse(request.body);
  const advisorResponse = await answerAdvisorQuestion(userId, payload.question);

  response.status(200).json({
    ...advisorResponse,
    timestamp: new Date().toISOString(),
  });
});

export { advisorRoutes };

