import { Request, Response } from "express";
import { addConfig, fetchConfig } from "../../util/functions";
import { Contest } from "../../util/types";

export async function getConfig(req: Request, res: Response) {
	const query = req.query;
	const page = Number(query.page) || 1;
	const maxResults =
		Number(query.maxResults) || Number(process.env.MAX_RESULTS);
	const skip = (page - 1) * maxResults;

	return res.json(await fetchConfig(skip, skip + maxResults - 1));
}

export async function postConfig(req: Request, res: Response) {
	console.log(req.body);
	const body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}
	await addConfig(body);
	return res.status(200).send();
}
