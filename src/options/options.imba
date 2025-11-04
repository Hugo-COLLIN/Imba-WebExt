# src/Options/Options.imba

tag OptionsApp
	prop settings = {
		enabled: true
		theme: 'light'
		notifications: false
	}

	def mount
		loadSettings!

	def loadSettings
		if typeof chrome !== 'undefined'
			chrome.storage.sync.get(['settings']) do |result|
				if result.settings
					settings = {...settings, ...result.settings}
				imba.commit!

	def saveSettings
		if typeof chrome !== 'undefined'
			chrome.storage.sync.set({settings: settings}) do
				showSavedMessage!

	def showSavedMessage
		const message = document.querySelector('.saved-message')
		if message
			message.style.display = 'block'
			setTimeout(&, 2000) do
				message.style.display = 'none'

	css .options-container
			max-width: 600px
			margin: 20px auto
			padding: 20px
			font-family: Arial, sans-serif
		
		.option-group
			margin: 15px 0
			
		label
			display: block
			margin-bottom: 5px
			
		input, select
			margin-right: 8px
			
		button
			background: #4CAF50
			color: white
			padding: 10px 20px
			border: none
			border-radius: 4px
			cursor: pointer
			margin-top: 20px
			
			&:hover
				background: #45a049

	<self>
		<div.options-container>
			<h1> "Options de l'Extension"
			
			<div.option-group>
				<label>
					<input type="checkbox" bind=settings.enabled>
					<span> "Activer l'extension"
			
			<div.option-group>
				<label> "Thème:"
				<select bind=settings.theme>
					<option value="light"> "Clair"
					<option value="dark"> "Sombre"
			
			<div.option-group>
				<label>
					<input type="checkbox" bind=settings.notifications>
					<span> "Notifications"
			
			<button @click=saveSettings> "Sauvegarder"
			
			<div.saved-message style="display: none; color: green; margin-top: 10px;">
				"Paramètres sauvegardés !"

# Monter l'application
imba.mount <OptionsApp>