import { Request, Response } from "express";
import { getClanScores } from "./clans";
import { getClient } from "../util/db";
import { UserCol } from "../util/types";

const {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
} = require("@google/generative-ai");

const MODEL_NAME = "gemini-pro";
const API_KEY = process.env.GEMINI_API;

export async function getNews(req: Request, res: Response) {
	const genAI = new GoogleGenerativeAI(API_KEY);
	const model = genAI.getGenerativeModel({ model: MODEL_NAME });

	const generationConfig = {
		temperature: 1,
		topK: 1,
		topP: 1,
		maxOutputTokens: 256,
	};

	const safetySettings = [
		{
			category: HarmCategory.HARM_CATEGORY_HARASSMENT,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
		{
			category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
		{
			category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
		{
			category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
			threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
		},
	];

	const scoreData = await getClanScores();

	const client = getClient();
	const db = client.db("clash-of-codes");
	const users = db.collection<UserCol>("Users");
	// random user
	const randomUser = await users
		.aggregate([
			{
				$sort: {
					score: -1,
				},
			},
			{
				$limit: 25,
			},
			{
				$sample: {
					size: 1,
				},
			},

			{
				$project: {
					_id: 0,
					name: 1,
				},
			},
		])
		.toArray();

	const randomUserName = randomUser[0].name;

	const parts = [
		{
			text: ` ${scoreData.toString()}# BW - blue wizards, PP - purple pekkas, RG - red giants, YB - yellow barbarians, use the full names \n# Based on the the above json data, consider the problemSolved as main number. describe the data while in a news headline of one sentence  , add the name "${randomUserName}" somewhere, and this name has nothing to do with the scores \n`,
		},
	];

	const result = await model.generateContent({
		contents: [{ role: "user", parts }],
		generationConfig,
		safetySettings,
	});

	const response = result.response;
	return res.send(response.text());
}
