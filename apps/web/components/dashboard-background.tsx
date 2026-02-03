export function DashboardBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Top-left corner pattern */}
      <svg className="absolute -top-20 -left-20 w-[600px] h-[600px] opacity-[0.15]" viewBox="0 0 400 400">
        <defs>
          <radialGradient id="fadeTopLeft" cx="0%" cy="0%" r="100%">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="1" />
            <stop offset="60%" stopColor="rgb(59, 130, 246)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 30 }).map((_, row) =>
          Array.from({ length: 30 }).map((_, col) => {
            const distance = Math.sqrt(row * row + col * col)
            const maxDistance = Math.sqrt(30 * 30 + 30 * 30)
            const size = Math.max(1, 4 - (distance / maxDistance) * 3.5)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.2)
            return (
              <circle
                key={`tl-${row}-${col}`}
                cx={col * 14 + 7}
                cy={row * 14 + 7}
                r={size}
                fill="rgb(59, 130, 246)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>

      {/* Top-right corner pattern */}
      <svg className="absolute -top-20 -right-20 w-[600px] h-[600px] opacity-[0.12]" viewBox="0 0 400 400">
        {Array.from({ length: 30 }).map((_, row) =>
          Array.from({ length: 30 }).map((_, col) => {
            const distance = Math.sqrt(row * row + (29 - col) * (29 - col))
            const maxDistance = Math.sqrt(30 * 30 + 30 * 30)
            const size = Math.max(1, 4 - (distance / maxDistance) * 3.5)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.2)
            return (
              <circle
                key={`tr-${row}-${col}`}
                cx={col * 14 + 7}
                cy={row * 14 + 7}
                r={size}
                fill="rgb(59, 130, 246)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>

      {/* Bottom-left corner pattern */}
      <svg className="absolute -bottom-20 -left-20 w-[500px] h-[500px] opacity-[0.08]" viewBox="0 0 400 400">
        {Array.from({ length: 25 }).map((_, row) =>
          Array.from({ length: 25 }).map((_, col) => {
            const distance = Math.sqrt((24 - row) * (24 - row) + col * col)
            const maxDistance = Math.sqrt(25 * 25 + 25 * 25)
            const size = Math.max(1, 3.5 - (distance / maxDistance) * 3)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.3)
            return (
              <circle
                key={`bl-${row}-${col}`}
                cx={col * 16 + 8}
                cy={row * 16 + 8}
                r={size}
                fill="rgb(100, 116, 139)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>

      {/* Bottom-right corner pattern */}
      <svg className="absolute -bottom-20 -right-20 w-[500px] h-[500px] opacity-[0.06]" viewBox="0 0 400 400">
        {Array.from({ length: 25 }).map((_, row) =>
          Array.from({ length: 25 }).map((_, col) => {
            const distance = Math.sqrt((24 - row) * (24 - row) + (24 - col) * (24 - col))
            const maxDistance = Math.sqrt(25 * 25 + 25 * 25)
            const size = Math.max(1, 3.5 - (distance / maxDistance) * 3)
            const opacity = Math.max(0, 1 - (distance / maxDistance) * 1.3)
            return (
              <circle
                key={`br-${row}-${col}`}
                cx={col * 16 + 8}
                cy={row * 16 + 8}
                r={size}
                fill="rgb(100, 116, 139)"
                opacity={opacity}
              />
            )
          })
        )}
      </svg>
    </div>
  )
}
