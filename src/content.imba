console.log window.location.href
# Extraire le contenu HTML de la page selon les sélecteurs configurés
def extractContent(config)
	try
		let htmlContent = ''
		
		# Extraire le contenu principal selon les sélecteurs
		const contentSelector = config.selectors.content
		const excludeSelector = config.selectors.exclude
		
		# Créer un conteneur temporaire pour le contenu extrait
		const container = document.createElement('div')
		
		# Trouver les éléments de contenu
		const contentElements = document.querySelectorAll(contentSelector)
		
		if contentElements.length === 0
			# Si aucun élément trouvé avec les sélecteurs, prendre le body
			htmlContent = document.body.innerHTML
		else
			# Copier les éléments de contenu
			for element of contentElements
				const clone = element.cloneNode(true)
				
				# Supprimer les éléments à exclure
				if excludeSelector
					const excludedElements = clone.querySelectorAll(excludeSelector)
					for excluded of excludedElements
						excluded.remove!
				
				container.appendChild(clone)
			
			htmlContent = container.innerHTML
		
		# Nettoyer le HTML (supprimer les scripts, styles inline excessifs, etc.)
		htmlContent = cleanHtml(htmlContent)
		
		return {
			success: true
			html: htmlContent
			meta: {
				title: extractTitle(config)
				description: extractDescription!
				author: extractAuthor!
			}
		}
	catch error
		console.error('Content extraction error:', error)
		return {
			success: false
			error: error.message
		}

# Nettoyer le HTML
def cleanHtml(html)
	const temp = document.createElement('div')
	temp.innerHTML = html
	
	# Supprimer les scripts
	const scripts = temp.querySelectorAll('script')
	for script of scripts
		script.remove!
	
	# Supprimer les iframes (optionnel)
	const iframes = temp.querySelectorAll('iframe')
	for iframe of iframes
		iframe.remove!
	
	# Supprimer les styles inline excessifs (optionnel)
	# Garder certains styles importants comme display: none pourrait cacher du contenu
	
	return temp.innerHTML

# Extraire le titre de la page
def extractTitle(config)
	const titleSelector = config.selectors.title
	
	# Essayer d'abord le sélecteur personnalisé
	if titleSelector
		const titleElement = document.querySelector(titleSelector)
		if titleElement
			return titleElement.textContent.trim!
	
	# Fallback sur le titre de la page
	return document.title || 'Untitled'

# Extraire la description
def extractDescription
	const metaDescription = document.querySelector('meta[name="description"]')
	if metaDescription
		return metaDescription.getAttribute('content')
	
	const ogDescription = document.querySelector('meta[property="og:description"]')
	if ogDescription
		return ogDescription.getAttribute('content')
	
	return ''

# Extraire l'auteur
def extractAuthor
	const metaAuthor = document.querySelector('meta[name="author"]')
	if metaAuthor
		return metaAuthor.getAttribute('content')
	
	const articleAuthor = document.querySelector('meta[property="article:author"]')
	if articleAuthor
		return articleAuthor.getAttribute('content')
	
	# Essayer de trouver un élément auteur dans le contenu
	const authorElement = document.querySelector('.author, .byline, [itemprop="author"]')
	if authorElement
		return authorElement.textContent.trim!
	
	return ''

# Extraire les images (fonction utilitaire pour une future utilisation)
def extractImages
	const images = []
	const imgElements = document.querySelectorAll('img')
	
	for img of imgElements
		if img.src && !img.src.includes('data:image')
			images.push {
				src: img.src
				alt: img.alt || ''
				width: img.width
				height: img.height
			}
	
	return images

# Extraire les liens (fonction utilitaire pour une future utilisation)
def extractLinks
	const links = []
	const linkElements = document.querySelectorAll('a[href]')
	
	for link of linkElements
		if link.href
			links.push {
				url: link.href
				text: link.textContent.trim!
				title: link.getAttribute('title') || ''
			}
	
	return links

# Capturer une zone spécifique de la page (pour une future fonctionnalité)
def captureSelection
	const selection = window.getSelection!
	
	if selection && selection.rangeCount > 0
		const range = selection.getRangeAt(0)
		const container = document.createElement('div')
		container.appendChild(range.cloneContents!)
		
		return {
			html: container.innerHTML
			text: selection.toString!
		}
	
	return null

# Écouter les messages du background script
chrome.runtime.onMessage.addListener do(message, sender, sendResponse)
	if message.action === 'extractContent'
		const result = extractContent(message.config)
		sendResponse(result)
		return true
	
	if message.action === 'captureSelection'
		const result = captureSelection!
		sendResponse(result)
		return true
	
	if message.action === 'ping'
		sendResponse({ status: 'ready' })
		return true

console.log('Content script loaded')