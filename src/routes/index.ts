import { Router } from "express";
import login from "./login";
import adminRouter from "./admin/index";
import getPastScores from "./pastScores";
const router = Router();
router.get("/login", login);
router.use("/admin", adminRouter);
router.get("/pastScores", getPastScores);
router.get("/", (req, res) => {
	return res.send("hello world");
});
export default router;
