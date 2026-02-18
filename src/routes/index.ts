import { Router } from "express";

import { advisorRoutes } from "./advisorRoutes";
import { authRoutes } from "./authRoutes";
import { financeRoutes } from "./financeRoutes";
import { healthRoutes } from "./healthRoutes";
import { plaidRoutes } from "./plaidRoutes";
import { requireAuth } from "../middleware/auth";

const apiRoutes = Router();

apiRoutes.use("/health", healthRoutes);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/plaid", requireAuth, plaidRoutes);
apiRoutes.use("/finance", requireAuth, financeRoutes);
apiRoutes.use("/advisor", requireAuth, advisorRoutes);

export { apiRoutes };

