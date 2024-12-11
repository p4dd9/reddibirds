class Logger {
	context: string

	constructor(context = '') {
		this.context = context ? `[${context}] ` : ''
	}

	log(level: 'info' | 'warn' | 'error', message: string) {
		const timestamp = new Date().toISOString()
		const formattedMessage = `${timestamp} [${level.toUpperCase()}] ${this.context}${message}`

		if (level === 'error') {
			console.error(formattedMessage)
		} else if (level === 'warn') {
			console.warn(formattedMessage)
		} else {
			console.log(formattedMessage)
		}
	}

	info(message: string | number) {
		this.log('info', message.toString())
	}

	warn(message: string | number) {
		this.log('warn', message.toString())
	}

	error(message: string | number) {
		this.log('error', message.toString())
	}
}

export const devvitLogger = new Logger('Devvit')
export const webviewLogger = new Logger('Webview')