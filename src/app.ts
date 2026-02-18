import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { apiRoutes } from "./routes";

const app = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin:
      env.corsOrigins.length === 1 && env.corsOrigins[0] === "*"
        ? true
        : env.corsOrigins,
    credentials: false,
  }),
);
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use("/api/v1", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };

