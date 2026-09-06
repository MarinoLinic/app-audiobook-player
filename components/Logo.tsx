import React from 'react'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

interface LogoProps {
	size?: number
	/** Show the app glyph on its orange tile (false = glyph only, transparent bg) */
	tiled?: boolean
}

/**
 * The Lector mark: an open book whose pages rise as audio bars under a
 * headphone band. Deliberately simple.
 */
export function Logo({ size = 72, tiled = true }: LogoProps) {
	return (
		<Svg width={size} height={size} viewBox="0 0 100 100">
			<Defs>
				<LinearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
					<Stop offset="0" stopColor="#ffb64d" />
					<Stop offset="1" stopColor="#f08000" />
				</LinearGradient>
			</Defs>
			{tiled && <Rect x="0" y="0" width="100" height="100" rx="24" fill="url(#lg)" />}
			{/* Headphone band */}
			<Path
				d="M28 44 C28 26 72 26 72 44"
				stroke={tiled ? '#1c1a17' : '#f8991c'}
				strokeWidth="7"
				strokeLinecap="round"
				fill="none"
			/>
			{/* Ear cups */}
			<Rect x="22" y="42" width="12" height="18" rx="6" fill={tiled ? '#1c1a17' : '#f8991c'} />
			<Rect x="66" y="42" width="12" height="18" rx="6" fill={tiled ? '#1c1a17' : '#f8991c'} />
			{/* Audio bars rising from the page line */}
			<Rect x="38" y="46" width="6" height="16" rx="3" fill={tiled ? '#1c1a17' : '#f8991c'} />
			<Rect x="47" y="38" width="6" height="24" rx="3" fill={tiled ? '#1c1a17' : '#f8991c'} />
			<Rect x="56" y="46" width="6" height="16" rx="3" fill={tiled ? '#1c1a17' : '#f8991c'} />
			{/* Open book base: a gentle V */}
			<Path
				d="M28 74 Q50 66 72 74"
				stroke={tiled ? '#1c1a17' : '#f8991c'}
				strokeWidth="6"
				strokeLinecap="round"
				fill="none"
			/>
		</Svg>
	)
}

/** Small circular badge variant used behind track rows etc. */
export function LogoBadge({ size = 20 }: { size?: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 100 100">
			<Circle cx="50" cy="50" r="50" fill="#f8991c" />
			<Rect x="36" y="40" width="7" height="24" rx="3.5" fill="#1c1a17" />
			<Rect x="46.5" y="30" width="7" height="40" rx="3.5" fill="#1c1a17" />
			<Rect x="57" y="40" width="7" height="24" rx="3.5" fill="#1c1a17" />
		</Svg>
	)
}
