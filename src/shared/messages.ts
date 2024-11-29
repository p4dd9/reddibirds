import type { Stats } from './types'

export type SaveStatsMessage = {
	type: 'saveStats'
	data: {
		personal: Pick<Stats, 'highscore'>
	}
}

export type StartGameMessage = {
	type: 'startGame'
	data: {
		personal: Stats
	}
}
