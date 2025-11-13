import browser from 'webextension-polyfill'

tag OptionsApp
	prop settings = {}

	prop defaultSettings = {
		enabled: true
		theme: 'light'
		notifications: false
	}

	prop showSaved = no
	
	def mount
		loadSettings!

	def loadSettings
		const result = await browser.storage.sync.get(['settings'])
		settings = {...defaultSettings, ...result.settings} if result.settings

	def saveSettings
		try
			await browser.storage.sync.set({settings: settings})
			console.log "Settings saved!"
			const response = await browser.runtime.sendMessage({ 
				message: "Saved settings", 
				type: "PING" 
			})
			console.log "Message from the background script: {response.message}"
			showSavedMessage!
		catch error
			console.log "Error: {error}"

	def showSavedMessage
		showSaved = yes
		imba.commit!
		setTimeout(&, 2000) do
			showSaved = no
			imba.commit!

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
			<h1> "Extension Options"
			
			<div.option-group>
				<label>
					<input type="checkbox" bind=settings.enabled>
					<span> "Enable extension"
			
			<div.option-group>
				<label> "Thème:"
				<select bind=settings.theme>
					<option value="light"> "Light"
					<option value="dark"> "Dark"
			
			<div.option-group>
				<label>
					<input type="checkbox" bind=settings.notifications>
					<span> "Notifications"
			
			<button @click=saveSettings> "Save"
			<div [d:none] [d:block color:green mt:10px]=showSaved>
				"Settings saved!"

# Mount the app
imba.mount <OptionsApp>