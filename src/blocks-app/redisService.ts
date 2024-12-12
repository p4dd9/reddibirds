import { Devvit, type RedisClient } from '@devvit/public-api'
import type { AppData } from '../shared/messages'
import { ACTIVE_PLAYERS_HASH, ACTIVE_PLAYER_TTL } from './config/redis.config'
import { mapAppConfiguration } from './redisMapper'
import type { SaveScoreData } from './types/redis'

export class RedisService {
	context: Devvit.Context
	redis: RedisClient

	subredditId: string
	postId: string
	userId: string

	constructor(context: Devvit.Context) {
		this.context = context
		this.redis = context.redis

		this.subredditId = context.subredditId

		this.postId = context.postId!
		this.userId = context.userId!
	}

	async getAppData(): Promise<AppData> {
		const [appConfiguration, leaderboard, activeCommunityPlayers] = await Promise.all([
			this.getAppConfiguration(),
			this.getCommunityLeaderBoard(),
			this.getCommunityOnlinePlayers(),
		])

		return {
			config: mapAppConfiguration(appConfiguration),
			community: {
				name: this.context.subredditName ?? 'REDDIBIRDS',
				leaderboard: leaderboard,
				online: activeCommunityPlayers,
			},
			// https://developers.reddit.com/docs/api/public-api/#-redisclient
			// https://discord.com/channels/1050224141732687912/1242689538447507458/1316043291401125888
			global: {
				name: 'REDDIBIRDS GLOBAL',
				leaderboard: [],
			},
		}
	}

	async saveScore(stats: SaveScoreData) {
		let mappedTopPlayer = '???'

		if (!this.userId) return { communityScore: 0, communityAttempts: 0, topPlayer: mappedTopPlayer }

		const currentTopPlayer = await this.redis.zRange(`post:${this.subredditId}:highscores`, 0, 0, {
			by: 'rank',
			reverse: true,
		})

		await this.redis.zAdd(`post:${this.subredditId}:highscores`, { member: this.userId, score: stats.highscore })
		await this.redis.hIncrBy(`post:${this.subredditId}:attempts`, this.userId, 1)

		const communityScore = this.incrementCurrentCommunityScore(stats.score)
		const communityAttempts = this.incrementCurrentCommunityAttempts()

		const newTopPlayer = await this.redis.zRange(`post:${this.subredditId}:highscores`, 0, 0, {
			by: 'rank',
			reverse: true,
		})

		const topPlayerUsername = currentTopPlayer[0]
			? ((await this.context.reddit.getUserById(currentTopPlayer[0].member))?.username ?? '???')
			: `???`

		if (!newTopPlayer || !newTopPlayer[0] || !this.postId) {
			return { communityScore, communityAttempts, topPlayer: topPlayerUsername }
		}

		if (!currentTopPlayer[0]?.member) {
			const newTopUserName = await this.context.reddit.getUserById(newTopPlayer[0].member)

			if (newTopUserName) {
				this.context.scheduler.runJob({
					name: 'FIRST_FLAPPER_COMMENT',
					data: {
						username: newTopUserName.username,
						postId: this.postId,
						score: stats.score,
					},
					runAt: new Date(),
				})
			}
		}

		// new highscore in community on posting
		if (currentTopPlayer[0]) {
			const currentCommunityhighscore = currentTopPlayer[0].score
			const score = stats.score
			if (score > currentCommunityhighscore) {
				const newTopUserName = await this.context.reddit.getUserById(newTopPlayer[0].member)

				if (newTopUserName) {
					this.context.scheduler.runJob({
						name: 'NEW_HIGHSCORE_COMMENT',
						data: {
							username: newTopUserName.username,
							postId: this.postId,
							score: stats.score,
						},
						runAt: new Date(),
					})
				}
			}
		}

		return { communityScore, communityAttempts, topPlayer: topPlayerUsername }
	}

	async getCommunityLeaderBoard(limit: number = 10) {
		const topPlayers = await this.redis.zRange(`post:${this.subredditId}:highscores`, 0, limit - 1, {
			by: 'rank',
			reverse: true,
		})

		const mappedBestPlayers = await Promise.all(
			topPlayers.map(async ({ member, score }) => {
				const userNameResponse = await this.context.reddit.getUserById(member)
				const attempts = await this.redis.hGet(`post:${this.subredditId}:attempts`, member)
				return {
					userId: member,
					userName: userNameResponse ? userNameResponse.username : 'Anonymous',
					score,
					attempts: Number(attempts),
				}
			})
		)

		return mappedBestPlayers
	}

	async getCommunityOnlinePlayers() {
		const now = Date.now()

		await this.context.redis.hSet(ACTIVE_PLAYERS_HASH, { [this.userId]: now.toString() })

		const players = await this.context.redis.hGetAll(ACTIVE_PLAYERS_HASH)

		let onlinePlayersCount = 0
		const stalePlayers = []

		for (const [userId, timestamp] of Object.entries(players)) {
			if (now - parseInt(timestamp, 10) <= ACTIVE_PLAYER_TTL) {
				onlinePlayersCount += 1
			} else {
				stalePlayers.push(userId)
			}
		}

		if (stalePlayers.length > 0) {
			await this.context.redis.hDel(ACTIVE_PLAYERS_HASH, stalePlayers)
		}

		return onlinePlayersCount
	}

	async getCommunityStats() {
		const [communityScore, communityAttempts, topPlayerUsername] = await Promise.all([
			this.getCurrentCommunityScore(),
			this.getCurrentCommunityAttempts(),
			this.getCurrentCommunityHighScoreUsername(),
		])

		return {
			communityScore,
			communityAttempts,
			topPlayer: topPlayerUsername,
		}
	}

	/** COMMUNITY:USER */
	async getCurrentUserHighscore() {
		return (await this.redis.zScore(`post:${this.subredditId}:highscores`, this.userId)) ?? 0
	}

	async getCurrentUserAttempts() {
		return Number(await this.redis.hGet(`post:${this.subredditId}:attempts`, this.userId)) ?? 0
	}

	async getCurrentPlayerStats() {
		const [highscore, attempts] = await Promise.all([this.getCurrentUserHighscore(), this.getCurrentUserAttempts()])

		return {
			highscore,
			attempts,
		}
	}

	async getCurrentCommunityHighScoreUsername() {
		const currentTopPlayer = await this.getCurrentCommunityTopPlayerScore()

		if (currentTopPlayer.length < 1 || !currentTopPlayer[0]) return `???`
		const topPlayerUser = await this.context.reddit.getUserById(currentTopPlayer[0].member)
		if (!topPlayerUser) return `???`

		return topPlayerUser.username
	}

	/** COMMUNITY */
	async getAppConfiguration() {
		return await this.context.settings.getAll<Record<'worldSelect' | 'playerSelect' | 'pipeSelect', any>>()
	}

	async incrementCurrentCommunityScore(score: number) {
		return await this.redis.hIncrBy(`community:${this.context.subredditId}:score`, this.context.subredditId, score)
	}

	async incrementCurrentCommunityAttempts() {
		return await this.redis.hIncrBy(`community:${this.context.subredditId}:attempts`, this.context.subredditId, 1)
	}

	async getCurrentCommunityScore() {
		return (await this.redis.hGet(`community:${this.context.subredditId}:score`, this.context.subredditId)) ?? 0
	}

	async getCurrentCommunityAttempts() {
		return (
			Number(await this.redis.hGet(`community:${this.context.subredditId}:attempts`, this.context.subredditId)) ??
			0
		)
	}

	async getCurrentCommunityTopPlayerScore() {
		return await this.redis.zRange(`post:${this.subredditId}:highscores`, 0, 0, {
			by: 'rank',
			reverse: true,
		})
	}
}
