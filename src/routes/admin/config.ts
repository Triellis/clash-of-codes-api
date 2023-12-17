import { Request, Response } from "express";
import { fetchConfig } from "../../util/functions";

export async function getConfig(req: Request, res: Response) {
	const query = req.query;
	const page = Number(query.page) || 1;
	const maxResults =
		Number(query.maxResults) || Number(process.env.MAX_RESULTS);
	const skip = (page - 1) * maxResults;
	console.log(skip + maxResults);
	return res.json(await fetchConfig(skip, skip + maxResults - 1));
}
