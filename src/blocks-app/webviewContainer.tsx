import { Devvit, useAsync, useChannel, useInterval, useState } from '@devvit/public-api'
import type { PostMessageMessages, UpdateGameSettingMessage, UpdateOnlinePlayersMessage } from '../shared/messages'
import { mappAppSettingsToMessage } from './redisMapper'
import { createRedisService, type CommunityStats } from './redisService'

type WebviewContainerProps = {
	context: Devvit.Context
	webviewVisible: boolean
}

export function WebviewContainer(props: WebviewContainerProps): JSX.Element {
	const { webviewVisible, context } = props
	const redisService = createRedisService(context)

	const emitUserPlaying = async () => {
		const count = (await redisService.saveUserInteraction()) ?? 0
		onlinePlayersChannel.send({ type: 'updateOnlinePlayers', count: count })
	}
	useInterval(emitUserPlaying, 10000).start()

	const [communityScore, setCommunityScore] = useState<CommunityStats>(async () => {
		return await redisService.getCommunityStats()
	})

	const communityStatsChannel = useChannel({
		name: 'community_score',
		onMessage: (data: { type: string; scoreStats: CommunityStats }) => {
			if (data.type === 'update') {
				setCommunityScore(data.scoreStats)
			}
		},
	})

	const onlinePlayersChannel = useChannel({
		name: 'online_player',
		onMessage: (data: { type: string; count: number }) => {
			if (data.type === 'updateOnlinePlayers') {
				context.ui.webView.postMessage('game-webview', {
					type: 'updateOnlinePlayers',
					data: { count: data.count },
				} as UpdateOnlinePlayersMessage)
			}
		},
	})

	useAsync(
		async () => {
			if (webviewVisible) {
				const appSettings = await redisService.getAppSettings()
				const mappedMessage = mappAppSettingsToMessage(appSettings)
				context.ui.webView.postMessage('game-webview', {
					type: 'changeWorld',
					data: mappedMessage,
				} as UpdateGameSettingMessage)
			} else {
				emitUserPlaying()
			}
			return null
		},
		{ depends: [webviewVisible] }
	)

	const handleMessage = async (ev: PostMessageMessages) => {
		console.log('Received message', ev)

		switch (ev.type) {
			case 'saveStats': {
				const newScore = ev.data.personal.highscore
				let currentPersonalStats = await redisService.getPlayerStats()

				if (!currentPersonalStats) {
					currentPersonalStats = { highscore: 0, attempts: 0 }
				}

				const isNewHighScore = newScore > currentPersonalStats.highscore
				const scoreStats = await redisService.saveScore({
					highscore: isNewHighScore ? newScore : currentPersonalStats.highscore,
					score: newScore,
				})

				if (isNewHighScore) {
					context.ui.showToast({ text: `Saved new Highscore ${newScore}!`, appearance: 'success' })
				}
				await communityStatsChannel.send({ type: 'update', scoreStats })

				context.ui.webView.postMessage('game-webview', {
					type: 'gameOver',
					data: {
						isNewHighScore,
						newScore,
						highscore: isNewHighScore ? newScore : currentPersonalStats.highscore,
						attempts: currentPersonalStats.attempts + 1,
					},
				})
				break
			}

			case 'getBestPlayers': {
				const bestPlayers = await redisService.getTopPlayers()
				if (!bestPlayers || bestPlayers.length < 0) return
				context.ui.webView.postMessage('game-webview', {
					type: 'updateBestPlayers',
					data: bestPlayers,
				})
				break
			}

			case 'requestAppSettings': {
				const appSettings = await redisService.getAppSettings()
				const mappedMessage = mappAppSettingsToMessage(appSettings)

				context.ui.webView.postMessage('game-webview', {
					type: 'changeWorld',
					data: mappedMessage,
				} as UpdateGameSettingMessage)

				break
			}
			default: {
				console.log(`Unknown message type "${(ev as unknown as any).type}" !`)
			}
		}
	}

	communityStatsChannel.subscribe()
	onlinePlayersChannel.subscribe()

	return (
		<vstack grow={webviewVisible} height={webviewVisible ? '100%' : '0px'}>
			<webview
				id="game-webview"
				url="index.html"
				grow
				width="100%"
				minWidth="100%"
				onMessage={(msg) => handleMessage(msg as PostMessageMessages)}
			/>
			<vstack alignment="middle center" width="100%" minWidth="100%">
				<text>
					r/ Score: {communityScore.communityScore}, Attempts: {communityScore.communityAttempts}, MVP:{' '}
					{communityScore.topPlayer}
				</text>
			</vstack>
		</vstack>
	)
}
