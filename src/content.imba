console.log "Content script loaded on:", window.location.href

# Injection d'un élément dans la page
const injectedElement = <div>
	<p> "Extension Imba active!"
	<style>
		position: fixed
		top: 10px
		right: 10px
		background: #4CAF50
		color: white
		padding: 10px
		border-radius: 5px
		z-index: 10000
		font-family: Arial, sans-serif

document.body.appendChild(injectedElement)

# Écouter les messages du background
if typeof chrome !== 'undefined'
	chrome.runtime.onMessage.addListener do |message, sender, sendResponse|
		console.log "Content script received:", message
		sendResponse({status: "received"})