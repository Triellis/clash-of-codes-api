import { Router } from "express";
import login from "./login";

const router = Router();
router.get("/login", login);
router.get("/", (req, res) => {
	res.send("hello world");
});
export default router;
