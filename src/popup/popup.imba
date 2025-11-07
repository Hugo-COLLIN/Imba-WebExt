import browser from 'webextension-polyfill'

tag PopupApp
	prop count

	def increment
		count++
		# Save in the storage
		browser.storage.local.set({count: count})

	def decrement
		count--
		# Save in the storage
		browser.storage.local.set({count: count})

	def mount
		# Load the saved value
		const result = await browser.storage.local.get(['count'])
		console.log result
		count = result.count || 0
	
	def openOptions
		browser.runtime.openOptionsPage!
	
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
			<h1> "Imba Extension"
			<p> "Counter: {count}"
			<button @click=increment> "Increment"
			<button @click=decrement> "Decrement"
			<button @click=openOptions> "Options"

# Mount the app
imba.mount <PopupApp>