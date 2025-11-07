import browser from 'webextension-polyfill'

console.log "Content script loaded on:", window.location.href
console.log "Content script loaded"

# Injection d'un élément dans la page
const injectedElement = <div>
	<p> "Imba Extension is active!"
	css position: fixed
		top: 10px
		right: 10px
		background: #4CAF50
		color: white
		padding: 10px
		border-radius: 5px
		z-index: 10000
		font-family: Arial, sans-serif

document.body.appendChild injectedElement

# Écouter les messages du background
browser.runtime.onMessage.addListener do |message, sender, sendResponse|
	console.log "Content script received:", message
	sendResponse({status: "received"})