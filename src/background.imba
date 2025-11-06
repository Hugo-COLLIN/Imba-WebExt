import TurndownService from 'turndown'
import browser from 'webextension-polyfill'

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

# Récupérer la configuration utilisateur
def getConfig
	try
		result = await browser.storage.sync.get('config')
		return if result.config then Object.assign({}, DEFAULT_CONFIG, result.config) else DEFAULT_CONFIG
	catch
		return DEFAULT_CONFIG


# Générer le nom de fichier à partir du template
def generateFilename(template, pageInfo)
	date = new Date
	dateStr = date.toISOString.split('T')[0]
	timeStr = date.toTimeString.split(' ')[0].replace(/:/g, '-')
	
	filename = template
		.replace('{title}', pageInfo.title || 'untitled')
		.replace('{url}', pageInfo.url || '')
		.replace('{domain}', pageInfo.domain || '')
		.replace('{date}', dateStr)
		.replace('{time}', timeStr)
	
	# Nettoyer le nom de fichier
	filename = filename.replace(/[<>:"/\\|?*]/g, '_')
	return filename

# Convertir HTML en différents formats
def convertContent(html, format, pageInfo)
	switch format
		when 'markdown'
			turndown = new TurndownService({
				headingStyle: 'atx'
				codeBlockStyle: 'fenced'
			})
			return turndown.turndown(html)
		when 'txt'
			temp = document.createElement('div')
			temp.innerHTML = html
			return temp.textContent || temp.innerText || ''
		when 'html'
			return html
		when 'pdf'
			# Pour PDF, on retourne le HTML qui sera converti côté navigateur
			return html
		else
			return html

# Sauvegarder le contenu
def saveContent(content, filename, format, channels)
	promises = []
	
	for channel in channels
		switch channel
			when 'download'
				promises.push downloadFile(content, filename, format)
			when 'clipboard'
				promises.push copyToClipboard(content)
			when 'webhook'
				promises.push sendToWebhook(content, filename, format)
	
	return await Promise.all(promises)

# Télécharger le fichier
def downloadFile(content, filename, format)
	try
		mimeTypes = {
			markdown: 'text/markdown'
			html: 'text/html'
			txt: 'text/plain'
			pdf: 'application/pdf'
		}
		
		extension = if format == 'markdown' then 'md' else format
		blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' })
		url = URL.createObjectURL(blob)
		
		if browser.downloads
			downloadId = await browser.downloads.download(
				url: url
				filename: "{filename}.{extension}"
				saveAs: true
			)
			URL.revokeObjectURL(url)
			return downloadId
		else
			# Fallback pour les navigateurs sans API downloads
			a = document.createElement('a')
			a.href = url
			a.download = "{filename}.{extension}"
			a.click
			URL.revokeObjectURL(url)
			return true
	catch error
		throw error

# Copier dans le presse-papier
def copyToClipboard(content)
	try
		if navigator.clipboard
			await navigator.clipboard.writeText(content)
			return true
		else
			# Fallback
			textarea = document.createElement('textarea')
			textarea.value = content
			document.body.appendChild(textarea)
			textarea.select
			document.execCommand('copy')
			document.body.removeChild(textarea)
			return true
	catch error
		throw error

# Envoyer au webhook
def sendToWebhook(content, filename, format)
	try
		config = await getConfig
		
		if !config.webhookUrl
			return false
		
		response = await fetch(config.webhookUrl, {
			method: 'POST'
			headers: {
				'Content-Type': 'application/json'
			}
			body: JSON.stringify({
				filename: filename
				format: format
				content: content
				timestamp: new Date.toISOString
			})
		})
		
		if response.ok
			return true
		else
			throw new Error("Webhook failed: {response.status}")
	catch error
		throw error

# Extraire les informations de la page
def getPageInfo(tab)
	return {
		title: tab.title
		url: tab.url
		domain: new URL(tab.url).hostname
		tabId: tab.id
	}

# Gestionnaire principal
def handleExtraction
	try
		# 1. Récupérer la configuration
		config = await getConfig
		
		# 2. Récupérer l'onglet actif
		tabs = await browser.tabs.query({ active: true, currentWindow: true })
		tab = tabs[0]
		
		if !tab
			throw new Error('No active tab found')
		
		pageInfo = getPageInfo(tab)
		
		# 3. Demander au content script d'extraire le contenu
		response = await browser.tabs.sendMessage(tab.id, {
			action: 'extractContent'
			config: config
		})
		
		if !response || !response.html
			throw new Error('Failed to extract content from page')
		
		# 4. Convertir le contenu au format souhaité
		convertedContent = convertContent(response.html, config.outputFormat, pageInfo)
		
		# 5. Générer le nom de fichier
		filename = generateFilename(config.filenameTemplate, pageInfo)
		
		# 6. Sauvegarder selon les canaux configurés
		await saveContent(convertedContent, filename, config.outputFormat, config.outputChannels)
		
		return { success: true, filename: filename }
	catch error
		console.error('Extraction error:', error)
		return { success: false, error: error.message }

# Écouter les messages
browser.runtime.onMessage.addListener do(message, sender)
	if message.action == 'extract'
		return handleExtraction!

# Écouter le clic sur l'icône de l'extension
if browser.action
	browser.action.onClicked.addListener do(tab)
		handleExtraction!
else if browser.browserAction
	browser.browserAction.onClicked.addListener do(tab)
		handleExtraction!

console.log('Background script loaded!')

def test
	const a = await browser.storage.sync.get('config')
	a.outputFormat = "pdf!!"
	await browser.storage.sync.set('config', a)
	const x = await browser.storage.sync.get('config')

	console.log a, x

test!


