import { TokenPayload } from "google-auth-library";
import { ObjectId } from "mongodb";

export type GoogleTokenPayload = TokenPayload | 401;
export type Clan = "BW" | "RG" | "YB" | "PP";

export interface ContestCol {
	_id?: ObjectId;
	ContestCode: string;
	DateAdded: Date;
	Live: boolean;
}

export type UserCol = {
	_id?: ObjectId;
	name: string;
	email: string;
	role: "User" | "Admin" | "Elder" | "Member" | "Leader" | "CoLeader";
	clan: null | Clan;
	visits: number;
	createdAt: Date;
	lastVisit: Date;
	cfUsername?: string;
	score?: number;
	problemSolved?: number;
};

export type UserOnClient = Omit<UserCol, "visits" | "createdAt" | "lastVisit">;
export const UserOnClientProj = {
	visits: 0,
	createdAt: 0,
	lastVisit: 0,
};

export type CFAPIResponse = {
	rank: number;
	points: number;
	penalty: number;
	username: string;
};

type modifiedCFResponse = {
	name: string;
	cfUsername: string;
} & Omit<CFAPIResponse, "username">;
type MetaData = {
	team1: {
		team: Clan;
		name: string;
	};
	team2: {
		team: Clan;
		name: string;
	};
	contestCode: string;
};
type liveBoardTeam = {
	metaData: MetaData;
	leaderboardData: {
		[key in Clan]: modifiedCFResponse[];
	};
};

export type liveLeaderboard = liveBoardTeam[];

export type CFSecretData = {
	CF_API_KEY: string;
	CF_SECRET: string;
	CF_GROUP_CODE: string;
};
export type RatingData = {
	username: string;
	rating: number;
	points: number;
}[];
export type ProcessedRatingData = {
	[key in Clan]?: {
		name: string;
		cfUsername: string;
		rating: number;
		points: number;
	}[];
};
export type PastScoresCol = {
	dateAdded: Date;
	contestId: ObjectId;
} & ProcessedRatingData;
