# src/options/options.imba

# Configuration par défaut
const DEFAULT_CONFIG = {
	outputFormat: 'markdown'
	outputChannels: ['download']
	webhookUrl: ''
	filenameTemplate: '{title}_{date}_{time}'
	selectors: {
		title: 'h1, title'
		content: 'main, article, .content, body'
		exclude: 'nav, footer, .sidebar, .ads'
	}
}

# Composant principal des options
tag app-options
	prop config = DEFAULT_CONFIG
	prop saving = false
	prop message = ''

	def mount
		loadConfig!

	# Charger la configuration
	def loadConfig
		try
			if chrome.storage
				const result = await chrome.storage.sync.get('config')
				if result.config
					config = Object.assign({}, DEFAULT_CONFIG, result.config)
					imba.commit!
		catch error
			showMessage("Erreur lors du chargement: {error.message}", 'error')

	# Sauvegarder la configuration
	def saveConfig
		saving = true
		message = ''
		
		try
			if chrome.storage
				await chrome.storage.sync.set({ config: config })
				showMessage('Configuration sauvegardée avec succès!', 'success')
			else
				showMessage('Stockage non disponible', 'error')
		catch error
			showMessage("Erreur lors de la sauvegarde: {error.message}", 'error')
		finally
			saving = false
			imba.commit!

	# Afficher un message
	def showMessage(text, type = 'info')
		message = { text: text, type: type }
		imba.commit!
		
		setTimeout(&, 3000) do
			message = ''
			imba.commit!

	# Réinitialiser la configuration
	def resetConfig
		if confirm('Êtes-vous sûr de vouloir réinitialiser la configuration?')
			config = Object.assign({}, DEFAULT_CONFIG)
			await saveConfig!

	# Gestionnaires d'événements
	def handleFormatChange(e)
		config.outputFormat = e.target.value
		imba.commit!

	def handleChannelToggle(channel)
		const index = config.outputChannels.indexOf(channel)
		if index > -1
			config.outputChannels.splice(index, 1)
		else
			config.outputChannels.push(channel)
		imba.commit!

	def handleWebhookChange(e)
		config.webhookUrl = e.target.value
		imba.commit!

	def handleFilenameTemplateChange(e)
		config.filenameTemplate = e.target.value
		imba.commit!

	def handleSelectorChange(type, e)
		config.selectors[type] = e.target.value
		imba.commit!

	# Rendu
	def render
		<self>
			<div.container>
				<header>
					<h1> "⚙️ Configuration de l'Extension"
					<p.subtitle> "Personnalisez le comportement de l'extraction de contenu"

				# Message de statut
				if message
					<div.message class=message.type>
						<p> message.text

				<form @submit.prevent=saveConfig>
					# Format de sortie
					<section.config-section>
						<h2> "📄 Format de sortie"
						<div.form-group>
							<label> "Format du fichier"
							<select bind=config.outputFormat @change=handleFormatChange>
								<option value="markdown"> "Markdown (.md)"
								<option value="html"> "HTML (.html)"
								<option value="txt"> "Texte brut (.txt)"

					# Canaux de sortie
					<section.config-section>
						<h2> "🚀 Canaux de sortie"
						<p.description> "Sélectionnez où vous souhaitez enregistrer le contenu"
						
						<div.checkbox-group>
							<label.checkbox>
								<input type="checkbox" 
									checked=config.outputChannels.includes('download')
									@change=handleChannelToggle('download')>
								<span> "💾 Télécharger le fichier"
							
							<label.checkbox>
								<input type="checkbox"
									checked=config.outputChannels.includes('clipboard')
									@change=handleChannelToggle('clipboard')>
								<span> "📋 Copier dans le presse-papier"
							
							<label.checkbox>
								<input type="checkbox"
									checked=config.outputChannels.includes('webhook')
									@change=handleChannelToggle('webhook')>
								<span> "🌐 Envoyer à un webhook"

						# URL du webhook si activé
						if config.outputChannels.includes('webhook')
							<div.form-group.webhook-input>
								<label> "URL du webhook"
								<input type="url" 
									bind=config.webhookUrl
									@input=handleWebhookChange
									placeholder="https://example.com/webhook">
								<small> "L'URL où le contenu sera envoyé en POST"

					# Template de nom de fichier
					<section.config-section>
						<h2> "📝 Nom du fichier"
						<div.form-group>
							<label> "Template du nom de fichier"
							<input type="text"
								bind=config.filenameTemplate
								@input=handleFilenameTemplateChange
								placeholder="{title}_{date}_{time}">
							<small.help-text>
								"Variables disponibles: "
								<code> "{title}"
								", "
								<code> "{date}"
								", "
								<code> "{time}"
								", "
								<code> "{url}"
								", "
								<code> "{domain}"

					# Sélecteurs CSS
					<section.config-section>
						<h2> "🎯 Sélecteurs de contenu"
						<p.description> "Configurez les sélecteurs CSS pour extraire le contenu pertinent"
						
						<div.form-group>
							<label> "Sélecteur de titre"
							<input type="text"
								value=config.selectors.title
								@input=handleSelectorChange('title', $event)
								placeholder="h1, title">
							<small> "Sélecteur CSS pour trouver le titre principal"
						
						<div.form-group>
							<label> "Sélecteur de contenu"
							<input type="text"
								value=config.selectors.content
								@input=handleSelectorChange('content', $event)
								placeholder="main, article, .content, body">
							<small> "Sélecteur CSS pour le contenu principal"
						
						<div.form-group>
							<label> "Sélecteur d'exclusion"
							<input type="text"
								value=config.selectors.exclude
								@input=handleSelectorChange('exclude', $event)
								placeholder="nav, footer, .sidebar, .ads">
							<small> "Éléments à exclure du contenu"

					# Boutons d'action
					<div.actions>
						<button.btn.btn-primary type="submit" disabled=saving>
							if saving
								"💾 Sauvegarde..."
							else
								"💾 Sauvegarder"
						
						<button.btn.btn-secondary type="button" @click=resetConfig>
							"🔄 Réinitialiser"

				<footer>
					<p> "💡 Astuce: Utilisez l'extension sur n'importe quelle page web pour extraire son contenu"

# Styles CSS
css self
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
	min-height: 100vh
	padding: 2rem
	color: #333

	.container
		max-width: 800px
		margin: 0 auto
		background: white
		border-radius: 12px
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3)
		overflow: hidden

	header
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
		color: white
		padding: 2rem
		text-align: center
		
		h1
			margin: 0 0 0.5rem 0
			font-size: 2rem
			font-weight: 700
		
		.subtitle
			margin: 0
			opacity: 0.9
			font-size: 1rem

	.message
		margin: 1.5rem
		padding: 1rem
		border-radius: 8px
		font-weight: 500
		
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

	form
		padding: 2rem

	.config-section
		margin-bottom: 2.5rem
		
		h2
			font-size: 1.3rem
			color: #667eea
			margin: 0 0 1rem 0
			font-weight: 600
		
		.description
			color: #666
			margin: 0 0 1rem 0
			font-size: 0.95rem

	.form-group
		margin-bottom: 1.5rem
		
		label
			display: block
			font-weight: 600
			margin-bottom: 0.5rem
			color: #333
		
		input[type="text"],
		input[type="url"],
		select
			width: 100%
			padding: 0.75rem
			border: 2px solid #e0e0e0
			border-radius: 8px
			font-size: 1rem
			transition: all 0.3s ease
			box-sizing: border-box
			
			&:focus
				outline: none
				border-color: #667eea
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1)
		
		small
			display: block
			color: #666
			margin-top: 0.5rem
			font-size: 0.875rem
		
		code
			background: #f5f5f5
			padding: 0.2rem 0.4rem
			border-radius: 4px
			font-family: 'Courier New', monospace
			font-size: 0.85rem

	.checkbox-group
		display: flex
		flex-direction: column
		gap: 1rem
		
		.checkbox
			display: flex
			align-items: center
			cursor: pointer
			padding: 0.75rem
			border-radius: 8px
			transition: background 0.2s ease
			
			&:hover
				background: #f5f5f5
			
			input[type="checkbox"]
				width: 20px
				height: 20px
				margin-right: 0.75rem
				cursor: pointer
			
			span
				font-size: 1rem

	.webhook-input
		margin-top: 1rem
		padding: 1rem
		background: #f9f9f9
		border-radius: 8px

	.help-text
		line-height: 1.6

	.actions
		display: flex
		gap: 1rem
		margin-top: 2rem
		padding-top: 2rem
		border-top: 2px solid #e0e0e0

	.btn
		padding: 0.75rem 1.5rem
		border: none
		border-radius: 8px
		font-size: 1rem
		font-weight: 600
		cursor: pointer
		transition: all 0.3s ease
		
		&:disabled
			opacity: 0.6
			cursor: not-allowed
		
		&:not(:disabled):hover
			transform: translateY(-2px)
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
	
	.btn-primary
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
		color: white
		flex: 1
		
		&:not(:disabled):hover
			box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4)
	
	.btn-secondary
		background: white
		color: #667eea
		border: 2px solid #667eea
		
		&:hover
			background: #f5f5f9

	footer
		background: #f9f9f9
		padding: 1.5rem
		text-align: center
		border-top: 1px solid #e0e0e0
		
		p
			margin: 0
			color: #666
			font-size: 0.95rem

# Point d'entrée
imba.mount <app-options>