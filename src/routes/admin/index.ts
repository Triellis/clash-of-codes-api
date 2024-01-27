import { NextFunction, Request, Response, Router } from "express";

import { deleteConfig, getConfig, postConfig, updateConfig } from "./config";
import { getSession } from "../../util/functions";
import { addUser, deleteUser, getUsers, updateUser } from "./users";
import { getCfConfig, postCfConfig } from "./cfSecretConfig";
const router = Router();

async function isAdmin(req: Request) {
	const userData = await getSession(req);
	console.log(userData);

	return userData.role === "Admin";
}

export async function validateAdmin(
	req: Request,
	res: Response,
	next: NextFunction
) {
	console.log(await isAdmin(req));
	if (!(await isAdmin(req))) {
		return res.send("Not an Admin").status(400);
	}
	next();
}
router.use(validateAdmin);
router.get("/config", getConfig);
router.post("/config", postConfig);
router.delete("/config", deleteConfig);
router.put("/config", updateConfig);

router.get("/users", getUsers);
router.delete("/users", deleteUser);
router.post("/users", addUser);
router.put("/users", updateUser);

router.get("/cfConfig", getCfConfig);
router.post("/cfConfig", postCfConfig);

export default router;
