# Composant popup de l'extension
tag app-popup
	prop loading = false
	prop status = ''
	prop statusType = 'info' # info, success, error
	prop config = null

	def mount
		loadConfig!

	# Charger la configuration
	def loadConfig
		try
			if window.chrome.storage
				const result = await window.chrome.storage.sync.get('config')
				config = result.config
				imba.commit!
		catch error
			console.error('Error loading config:', error)

	# Extraire le contenu de la page
	def extractContent
		loading = true
		status = 'Extraction en cours...'
		statusType = 'info'
		imba.commit!

		try
			# Envoyer un message au background script
			const response = await window.chrome.runtime.sendMessage({
				action: 'extract'
			})

			if response.success
				status = "✅ Contenu extrait: {response.filename}"
				statusType = 'success'
			else
				status = "❌ Erreur: {response.error}"
				statusType = 'error'
		catch error
			status = "❌ Erreur: {error.message}"
			statusType = 'error'
		finally
			loading = false
			imba.commit!
			
			# Effacer le message après 3 secondes
			setTimeout(&, 3000) do
				status = ''
				imba.commit!

	# Ouvrir la page d'options
	def openOptions
		if window.chrome.runtime.openOptionsPage
			window.chrome.runtime.openOptionsPage!
		else
			window.open(window.chrome.runtime.getURL('src/options/options.html'))

	def render
		<self>
			<div.popup-container>
				<header>
					<h1> "📥 Save Web Content"
					<p.subtitle> "Extraction rapide de contenu"

				<main>
					# Statut
					if status
						<div.status class=statusType>
							<p> status

					# Informations sur la configuration actuelle
					if config
						<div.config-info>
							<div.info-item>
								<span.label> "Format:"
								<span.value> config.outputFormat.toUpperCase!
							
							<div.info-item>
								<span.label> "Canaux:"
								<span.value> 
									if config.outputChannels.length > 0
										config.outputChannels.join(', ')
									else
										'Aucun'

					# Bouton principal d'extraction
					<button.btn.btn-extract 
						@click=extractContent
						disabled=loading>
						if loading
							<span.spinner> "⏳"
							" Extraction..."
						else
							"📥 Extraire le contenu"

					# Bouton des options
					<button.btn.btn-options @click=openOptions>
						"⚙️ Paramètres"

				<footer>
					<p> "Cliquez sur 'Extraire' pour sauvegarder le contenu de cette page"

# Styles
css self
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif
	
	.popup-container
		width: 320px
		background: white
		color: #333

	header
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
		color: white
		padding: 1.5rem
		text-align: center
		
		h1
			margin: 0 0 0.25rem 0
			font-size: 1.3rem
			font-weight: 700
		
		.subtitle
			margin: 0
			opacity: 0.9
			font-size: 0.85rem

	main
		padding: 1.5rem

	.status
		padding: 0.75rem
		border-radius: 6px
		margin-bottom: 1rem
		font-size: 0.9rem
		
		&.info
			background: #e3f2fd
			color: #1976d2
			border: 1px solid #bbdefb
		
		&.success
			background: #d4edda
			color: #155724
			border: 1px solid #c3e6cb
		
		&.error
			background: #f8d7da
			color: #721c24
			border: 1px solid #f5c6cb
		
		p
			margin: 0

	.config-info
		background: #f9f9f9
		padding: 1rem
		border-radius: 6px
		margin-bottom: 1rem
		font-size: 0.85rem
		
		.info-item
			display: flex
			justify-content: space-between
			margin-bottom: 0.5rem
			
			&:last-child
				margin-bottom: 0
			
			.label
				font-weight: 600
				color: #666
			
			.value
				color: #667eea
				font-weight: 500

	.btn
		width: 100%
		padding: 0.875rem
		border: none
		border-radius: 6px
		font-size: 1rem
		font-weight: 600
		cursor: pointer
		transition: all 0.2s ease
		margin-bottom: 0.75rem
		
		&:last-of-type
			margin-bottom: 0
		
		&:disabled
			opacity: 0.6
			cursor: not-allowed
		
		&:not(:disabled):hover
			transform: translateY(-1px)
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
	
	.btn-extract
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
		color: white
		
		.spinner
			display: inline-block
			animation: spin 1s linear infinite
		
		&:not(:disabled):hover
			box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4)
	
	.btn-options
		background: white
		color: #667eea
		border: 2px solid #e0e0e0
		
		&:hover
			border-color: #667eea
			background: #f5f5f9

	footer
		padding: 1rem 1.5rem
		background: #f9f9f9
		border-top: 1px solid #e0e0e0
		text-align: center
		
		p
			margin: 0
			font-size: 0.8rem
			color: #666
			line-height: 1.4

	@keyframes spin
		from
			transform: rotate(0deg)
		to
			transform: rotate(360deg)

tag counter
	prop count = 0;
	<self>
		<button @click=(count = count + 1)> "Increment"
		<p> count

# Point d'entrée
# imba.mount <app-popup>
imba.mount <counter>