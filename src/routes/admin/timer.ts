import { Request, Response } from "express";
import { getRedisClient } from "../../util/redis";

export async function postTimer(req: Request, res: Response) {
	// duration
	// start time
	// isRunning

	const body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}

	if (!body.duration) {
		return res.status(400).send("Please add duration in the body");
	}
	if (!body.startTime) {
		return res.status(400).send("Please add startTime in the body");
	}
	const redisClient = getRedisClient();
	const duration = Number(body.duration);
	const startTime = Number(body.startTime);
	const isRunning = "true";

	await redisClient.set("timerDuration", duration);
	await redisClient.set("timerStartTime", startTime);
	await redisClient.set("timerIsRunning", isRunning);
	return res.status(200).send();
}
