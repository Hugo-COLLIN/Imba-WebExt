import browser from 'webextension-polyfill'

console.log "🚀 Background script loaded"

# Manage installation
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

# Manage messages from content scripts and popup
if browser.runtime.onMessage
	browser.runtime.onMessage.addListener do(message, sender, sendResponse)
		console.log "📨 Message received:", message
		
		switch message.type
			when 'GET_DATA'
				# Retrieve data from storage
				browser.storage.sync.get null, do(data)
					sendResponse { success: true, data: data }
			
			when 'SET_DATA'
				# Save data
				browser.storage.sync.set message.data, do
					sendResponse { success: true }
			
			when 'PING'
				sendResponse { success: true, message: 'pong' }
		
		# Return true to indicate an asynchronous response
		return true

# Manage commands
if browser.commands..onCommand
	browser.commands.onCommand.addListener do(command)
		console.log "⌨️  Command received:", command