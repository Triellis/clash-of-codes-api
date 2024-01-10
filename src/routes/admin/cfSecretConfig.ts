import { Request, Response } from "express";
import { getRedisClient } from "../../util/redis";
import { getCFSecretData } from "../../util/functions";

export async function getCfConfig(req: Request, res: Response) {
	const data = await getCFSecretData();
	return res.json(data);
}

export async function postCfConfig(req: Request, res: Response) {
	const body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}
	if (!body.CF_API_KEY || !body.CF_SECRET || !body.CF_GROUP_CODE) {
		return res
			.send("Please provide CF_API_KEY, CF_SECRET, CF_GROUP_CODE")
			.status(400);
	}
	const redisClient = getRedisClient();
	await redisClient.set("CF_API_KEY", (body.CF_API_KEY as string).trim());
	await redisClient.set("CF_SECRET", (body.CF_SECRET as string).trim());
	await redisClient.set(
		"CF_GROUP_CODE",
		(body.CF_GROUP_CODE as string).trim()
	);
	return res.send("Done").status(200);
}
