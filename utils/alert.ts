import { Alert as NativeAlert, Platform } from 'react-native'

/** Native alerts keep their existing behavior; browser actions get real confirmations. */
export const Alert = {
	alert: ((title, message, buttons, options) => {
		if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons, options)
		if (typeof document === 'undefined') return
		const dialog = document.createElement('dialog')
		dialog.setAttribute('aria-label', title)
		dialog.style.cssText = 'width:min(390px,calc(100vw - 32px));padding:24px;border:1px solid #3c4452;border-radius:16px;background:#171b24;color:#f5f7fb;font:15px system-ui;box-shadow:0 24px 70px #0009;'
		const heading = document.createElement('h2')
		heading.textContent = title
		heading.style.cssText = 'margin:0 0 12px;font-size:20px;'
		dialog.append(heading)
		if (message) {
			const detail = document.createElement('p')
			detail.textContent = message
			detail.style.cssText = 'white-space:pre-wrap;line-height:1.5;margin:0 0 24px;color:#c9d0de;'
			dialog.append(detail)
		}
		const actions = document.createElement('div')
		actions.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;'
		const choices = buttons?.length ? buttons : [{ text: 'OK' }]
		const close = () => { dialog.close(); dialog.remove() }
		for (const choice of choices) {
			const button = document.createElement('button')
			button.textContent = choice.text || 'OK'
			button.style.cssText = `padding:11px 16px;border:1px solid #505b6e;border-radius:8px;font:600 14px system-ui;cursor:pointer;color:white;background:${choice.style === 'destructive' ? '#ac2434' : choice.style === 'cancel' ? '#303848' : '#2563eb'};`
			button.autofocus = choice.style === 'cancel' || choices.length === 1
			button.onclick = () => { close(); choice.onPress?.() }
			actions.append(button)
		}
		dialog.append(actions)
		dialog.addEventListener('cancel', (event) => {
			event.preventDefault()
			close()
			choices.find((choice) => choice.style === 'cancel')?.onPress?.()
			options?.onDismiss?.()
		})
		document.body.append(dialog)
		dialog.showModal()
	}) as typeof NativeAlert.alert,
}
