import type { Player } from '../../shared/messages'
import globalEventEmitter from '../web/GlobalEventEmitter'

export class Menu extends Phaser.Scene {
	gameTitleText: Phaser.GameObjects.Text

	playButton: Phaser.GameObjects.Image
	playButtonText: Phaser.GameObjects.Text

	personalHighscoreText: Phaser.GameObjects.Text
	muteButtonText: Phaser.GameObjects.Text

	isMute: boolean = false

	bestPlayer: Phaser.GameObjects.Text

	breakingNews: Phaser.GameObjects.Text

	constructor() {
		super('Menu')
	}

	create() {
		const centerX = this.scale.width / 2
		const centerY = this.scale.height / 2

		this.cameras.main.postFX.clear()

		this.sound.stopByKey('Junkala_Stake_2')
		if (!this.sound.get('Junkala_Select_2')?.isPlaying) {
			this.sound.play('Junkala_Select_2', { loop: true, volume: 0.05 })
		}

		globalEventEmitter.once('updateBestPlayers', (bestPlayers: Player[]) => {
			this.createBreakingNews(bestPlayers)
			this.createBestPlayer(bestPlayers[0])
		})
		globalEventEmitter.emit('getBestPlayers')

		this.gameTitleText = this.add
			.text(centerX, centerY - 110, 'REDDIBIRDS', {
				fontSize: 172,
				fontFamily: 'mago3',
				color: 'black',
			})
			.setOrigin(0.5)

		this.playButton = this.add
			.image(centerX, this.gameTitleText.y + 170, 'UI_Flat_Frame03a')
			.setDisplaySize(this.gameTitleText.displayWidth / 2, 100)
			.setOrigin(0.5)
			.setInteractive({ cursor: 'pointer' })
			.once('pointerdown', () => {
				this.sound.play('buttonclick1', { volume: 0.5 })
				this.scale.off('resize', this.resize, this)
				this.scene.start('Game')
			})
		this.playButtonText = this.add
			.text(centerX, this.playButton.y - 15, 'Play', {
				fontSize: '82px',
				fontFamily: 'mago3',
				color: 'black',
			})
			.setOrigin(0.5)

		this.muteButtonText = this.add
			.text(this.scale.width - 50, this.scale.height - 50, this.getMuteButtonText(), {
				fontSize: 72,
				fontFamily: 'mago3',
				color: 'black',
			})
			.setOrigin(1, 1)
			.setInteractive({ cursor: 'pointer' })
			.on('pointerdown', this.toggleMute, this)

		this.scale.on('resize', this.resize, this)
	}

	createBreakingNews(players: Player[]) {
		const topPlayers = players
			.slice(0, 3)
			.map((player) => `"${player.userName}" ${player.score}`)
			.join(',')
		let bannerText = `*LIVE* BREAKING SCORES! ${topPlayers} *LIVE*`
		if (players.length < 1) {
			bannerText = `*LIVE* OHH BOI! STRANGER IS FIRST IN LINE TO BIRD UP! *LIVE*`
		}

		this.breakingNews = this.add
			.text(this.scale.width, 0, `*LIVE* BREAKING SCORES! ${bannerText} *LIVE*`, {
				fontSize: 100,
				color: 'black',
				fontFamily: 'mago3',
			})
			.setOrigin(0, 0)
		this.startBreakingTheNews()
	}

	createBestPlayer(bestPlayer?: Player) {
		let text = `Let's play Reddibirds!!!`
		if (bestPlayer) {
			text = `${bestPlayer.userName}: ${bestPlayer.score}`
		}
		this.bestPlayer = this.add
			.text(450, this.scale.height - 200, text, {
				fontSize: 72,
				fontFamily: 'mago3',
				color: 'black',
			})
			.setOrigin(0.5, 0.5)
			.setAngle(10)
		this.add.tween({
			targets: this.bestPlayer,
			scale: 1.1,
			yoyo: true,
			duration: 1100,
			repeat: -1,
		})
	}

	startBreakingTheNews() {
		this.add.tween({
			targets: this.breakingNews,
			x: -this.breakingNews.displayWidth,
			duration: 9000,
			repeat: -1,
			onComplete: () => {
				this.breakingNews.x = this.scale.width
				this.startBreakingTheNews()
			},
		})
	}

	getMuteButtonText(): string {
		return this.isMute ? 'Unmute' : 'Mute'
	}

	toggleMute(): void {
		if (this.sound.locked) {
			console.warn('Sound system is locked. Waiting for user interaction.')
			return
		}
		this.sound.play('buttonclick1', { volume: 0.5 })
		this.isMute = !this.game.sound.mute
		this.sound.setMute(!this.game.sound.mute)
		this.muteButtonText.setText(this.getMuteButtonText())
	}

	resize() {
		this.gameTitleText.setPosition(this.scale.width / 2, this.scale.height / 2 - 110)

		this.playButton.setPosition(this.scale.width / 2, this.gameTitleText.y + 170)
		this.playButtonText.setPosition(this.scale.width / 2, this.playButton.y - 15)

		this.muteButtonText.setPosition(this.scale.width - 50, this.scale.height - 50)

		if (this.breakingNews) {
			this.breakingNews.setPosition(this.scale.width, 0)
		}

		if (this.bestPlayer) {
			this.bestPlayer.setPosition(450, this.scale.height - 200)
		}
	}
}
