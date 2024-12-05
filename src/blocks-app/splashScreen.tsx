import { Devvit } from '@devvit/public-api'

type SplashScreenProps = {
	context: Devvit.Context
	webviewVisible: boolean
	setWebviewVisible: (visible: boolean) => void
}

export function SplashScreen(props: SplashScreenProps): JSX.Element {
	const { webviewVisible, setWebviewVisible } = props

	const onLaunchApp = () => {
		setWebviewVisible(true)
	}

	return (
		<zstack grow={!webviewVisible} height={webviewVisible ? '0%' : '100%'}>
			<vstack grow height="100%" width="100%" alignment="middle center">
				<image
					url="splash-background.gif"
					height="100%"
					width="100%"
					imageWidth={808}
					imageHeight={254}
					resizeMode="cover"
				/>
			</vstack>
			<vstack grow height="100%" width="100%" alignment="middle center">
				<button onPress={onLaunchApp}>Launch Game</button>
			</vstack>
		</zstack>
	)
}
