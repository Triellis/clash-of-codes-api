import { Router } from "express";
import login from "./login";
import adminRouter from "./admin/index";
import getPastScores from "./pastScores";
import { getClans } from "./clans";
import { getNews } from "./getNews";
const router = Router();
router.get("/login", login);
router.use("/admin", adminRouter);
router.get("/pastScores", getPastScores);
router.get("/clans", getClans);
router.get("/getNews", getNews);
router.get("/", (req, res) => {
	return res.send("hello world");
});
export default router;
