import browser from 'webextension-polyfill'

console.log "Content script loaded on:", window.location.href
console.log "Content script loaded"

# Injecting an element in the page
# Don't use the Imba "XML" syntax here! 
# (Chrome compatibility VS Imba wants to define custom elements in the page)
const injectedElement = document.createElement('div')
injectedElement.className = 'imba-extension-notice'
injectedElement.innerHTML = '<p>Imba Extension is active!</p>'

# Add styles
injectedElement.style.cssText = `
	position: fixed;
	top: 10px;
	right: 10px;
	background: #4CAF50;
	color: white;
	padding: 10px;
	border-radius: 5px;
	z-index: 10000;
	font-family: Arial, sans-serif;
`

document.body.appendChild(injectedElement)

# Listen messages from background
browser.runtime.onMessage.addListener do |message, sender, sendResponse|
	console.log "Content script received:", message
	sendResponse({status: "received"})