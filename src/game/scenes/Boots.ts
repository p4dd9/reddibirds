import globalEventEmitter from '../web/GlobalEventEmitter'

export class Boot extends Phaser.Scene {
	constructor() {
		super('Boot')
	}

	init() {
		globalEventEmitter.emit('requestAppSettings')
		globalEventEmitter.on('changePipeFrame', (pipeFrame: number) => {
			this.game.registry.set('pipeFrame', pipeFrame)
		})
		globalEventEmitter.on('changePlayerFrame', (playerFrame: number) => {
			this.game.registry.set('playerFrame', playerFrame)
		})
	}

	create() {
		this.scene.start('Preloader')
	}
}
