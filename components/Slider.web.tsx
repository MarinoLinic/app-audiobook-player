import React, { useRef } from 'react'
import type { SliderProps } from '@react-native-community/slider'
import { StyleSheet } from 'react-native'

/** React 19 compatible browser range control; the native component stays unchanged. */
export default function Slider({ value = 0, minimumValue = 0, maximumValue = 1, step, disabled, style, thumbTintColor, minimumTrackTintColor, onValueChange, onSlidingStart, onSlidingComplete, accessibilityLabel }: SliderProps) {
	const active = useRef(false)
	const dimensions = StyleSheet.flatten(style)
	const start = (current: number) => { if (!active.current) { active.current = true; onSlidingStart?.(current) } }
	const finish = (current: number) => { if (active.current) { active.current = false; onSlidingComplete?.(current) } }
	return <input
		type="range"
		aria-label={accessibilityLabel || 'Slider'}
		value={value}
		min={minimumValue}
		max={maximumValue}
		step={step || 'any'}
		disabled={disabled}
		style={{ width: '100%', minWidth: 0, flexShrink: 1, flex: dimensions?.flex, height: typeof dimensions?.height === 'number' ? dimensions.height : 40, margin: 0, accentColor: String(thumbTintColor || minimumTrackTintColor || '#f8991c') }}
		onPointerDown={(event) => start(event.currentTarget.valueAsNumber)}
		onPointerUp={(event) => finish(event.currentTarget.valueAsNumber)}
		onPointerCancel={(event) => finish(event.currentTarget.valueAsNumber)}
		onBlur={(event) => finish(event.currentTarget.valueAsNumber)}
		onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) start(event.currentTarget.valueAsNumber) }}
		onKeyUp={(event) => finish(event.currentTarget.valueAsNumber)}
		onChange={(event) => onValueChange?.(event.currentTarget.valueAsNumber)}
	/>
}
