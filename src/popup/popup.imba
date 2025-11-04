# src/Popup/Popup.imba

tag PopupApp
	prop count = 0

	def increment
		count++
		# Sauvegarder dans le storage
		if typeof chrome !== 'undefined'
			chrome.storage.local.set({count: count})

	def mount
		# Charger la valeur sauvegardée
		if typeof chrome !== 'undefined'
			chrome.storage.local.get(['count']) do |result|
				count = result.count || 0
				imba.commit!
	
	def openOptions
		if typeof chrome !== 'undefined'
			chrome.runtime.openOptionsPage!
	
	css .popup-container
				padding: 20px
				min-width: 300px
				font-family: Arial, sans-serif
			
		button
			margin: 5px
			padding: 8px 16px
			background: #4CAF50
			color: white
			border: none
			border-radius: 4px
			cursor: pointer
			
			&:hover
				background: #45a049

	<self>
		<div.popup-container>
			<h1> "Extension Imba"
			<p> "Compteur: {count}"
			<button @click=increment> "Incrémenter"
			<button @click=(count--)> "Decrement"
			<button @click=openOptions> "Options"

# Monter l'application
imba.mount <PopupApp>