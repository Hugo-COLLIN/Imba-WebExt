# Background script pour Chrome & Firefox
# Ce fichier est le service worker (Chrome MV3) ou script background (Firefox MV2)

console.log "🚀 Background script loaded"

# Détection du navigateur
const browser = globalThis.browser || globalThis.chrome

# Gestion de l'installation
if browser.runtime.onInstalled
	browser.runtime.onInstalled.addListener do(details)
		if details.reason === 'install'
			console.log "📦 Extension installed"
			# Initialiser le storage
			browser.storage.sync.set {
				initialized: true
				installDate: Date.now!
			}
		elif details.reason === 'update'
			console.log "🔄 Extension updated"

# Gestion des messages depuis content scripts ou popup
if browser.runtime.onMessage
	browser.runtime.onMessage.addListener do(message, sender, sendResponse)
		console.log "📨 Message received:", message
		
		switch message.type
			when 'GET_DATA'
				# Récupérer des données du storage
				browser.storage.sync.get null, do(data)
					sendResponse { success: true, data: data }
			
			when 'SET_DATA'
				# Sauvegarder des données
				browser.storage.sync.set message.data, do
					sendResponse { success: true }
			
			when 'PING'
				sendResponse { success: true, message: 'pong' }
		
		# Retourner true pour indiquer une réponse asynchrone
		return true

# Gestion des commandes
if browser.commands?.onCommand
	browser.commands.onCommand.addListener do(command)
		console.log "⌨️  Command received:", command