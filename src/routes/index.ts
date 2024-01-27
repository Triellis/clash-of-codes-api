import { Router } from "express";
import login from "./login";
import adminRouter from "./admin/index";
import getPastScores from "./pastScores";
import { getClans } from "./clansRanks";
import { getClan } from "./myClan";
const router = Router();
router.get("/login", login);
router.use("/admin", adminRouter);
router.get("/pastScores", getPastScores);
router.get("/clans", getClans);
router.get("/", (req, res) => {
	return res.send("hello world");
});
router.get("/clan/:clanName", getClan);
export default router;
