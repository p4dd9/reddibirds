import { Devvit, RichTextBuilder } from '@devvit/public-api'
import type { Player } from '../shared/messages'

export type SaveScoreData = {
	highscore: number
}

export type PlayerStats = {
	highscore: number
	attempts: number
}

export type RedisService = {
	getPlayerStats: () => Promise<PlayerStats | null>
	saveScore: (stats: SaveScoreData) => Promise<void>
	getBestPlayer: () => Promise<Player | null>
	getTopPlayers: () => Promise<Array<Player>>
	getPlayerByUserId: (userId: string) => Promise<PlayerStats | null>
}

export function createRedisService(context: Devvit.Context): RedisService {
	const { redis, postId, userId } = context

	return {
		getPlayerStats: async () => {
			if (!userId) return null

			const attempts = await redis.hGet(`post:${postId}:attempts`, userId)
			const highscore = await redis.zScore(`post:${postId}:highscores`, userId)

			const mappedStats = {
				highscore: highscore ? Number(highscore) : 0,
				attempts: attempts ? Number(attempts) : 0,
			}
			return mappedStats
		},

		getPlayerByUserId: async (userId: string) => {
			if (!userId) return null

			const attempts = await redis.hGet(`post:${postId}:attempts`, userId)
			const highscore = await redis.zScore(`post:${postId}:highscores`, userId)

			const mappedStats = {
				highscore: highscore ? Number(highscore) : 0,
				attempts: attempts ? Number(attempts) : 0,
			}
			return mappedStats
		},

		saveScore: async (stats) => {
			if (!userId) return

			const currentTopPlayer = await redis.zRange(`post:${postId}:highscores`, 0, 0, {
				by: 'rank',
				reverse: true,
			})

			await redis.zAdd(`post:${postId}:highscores`, { member: userId, score: stats.highscore })
			await redis.hIncrBy(`post:${postId}:attempts`, userId, 1)

			const newTopPlayer = await redis.zRange(`post:${postId}:highscores`, 0, 0, {
				by: 'rank',
				reverse: true,
			})

			if (!newTopPlayer || !newTopPlayer[0] || !postId) {
				return
			}

			if (newTopPlayer.length > 0 && newTopPlayer[0].member !== (currentTopPlayer[0]?.member || null)) {
				const newTopUserName = await context.reddit.getUserById(newTopPlayer[0].member)

				if (newTopUserName) {
					const comment = await context.reddit.submitComment({
						id: postId,
						richtext: new RichTextBuilder().codeBlock({}, (cb) =>
							cb.rawText(`"${newTopUserName.username}"s highscore is ${newTopPlayer[0]?.score}!`)
						),
					})

					if (comment) {
						context.ui.showToast('Your fantastic highscore was shared as a comment!')
					}
				}
			}
		},

		getBestPlayer: async () => {
			const bestPlayer = await redis.zRange(`post:${postId}:highscores`, 0, 1, {
				by: 'rank',
				reverse: true,
			})

			if (bestPlayer.length === 0 || !bestPlayer[0]) return null
			const bestPlayerUserName = await context.reddit.getUserById(bestPlayer[0].member)
			if (!bestPlayerUserName) return null

			const mappedBestPlayer = {
				userId: bestPlayer[0].member,
				userName: bestPlayerUserName.username,
				score: Number(bestPlayer[0].score),
			}

			return mappedBestPlayer
		},

		getTopPlayers: async () => {
			const topPlayers = await redis.zRange(`post:${postId}:highscores`, 0, 9, {
				by: 'rank',
				reverse: true,
			})

			const mappedBestPlayers = await Promise.all(
				topPlayers.map(async ({ member, score }) => {
					const userNameResponse = await context.reddit.getUserById(member)
					return {
						userId: member,
						userName: userNameResponse ? userNameResponse.username : 'Anonymous',
						score: Number(score),
					}
				})
			)

			return mappedBestPlayers
		},
	}
}
