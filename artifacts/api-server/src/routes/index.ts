import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import workoutsRouter from "./workouts";
import goalsRouter from "./goals";
import badgesRouter from "./badges";
import challengesRouter from "./challenges";
import variationsRouter from "./variations";
import coachRouter from "./coach";
import rivalsRouter from "./rivals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(workoutsRouter);
router.use(goalsRouter);
router.use(badgesRouter);
router.use(challengesRouter);
router.use(variationsRouter);
router.use(coachRouter);
router.use(rivalsRouter);

export default router;
