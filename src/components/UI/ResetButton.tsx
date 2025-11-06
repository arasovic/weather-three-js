interface ResetButtonProps {
  onClick: () => void
  className?: string
}

function ResetButton({ onClick, className }: ResetButtonProps) {
  const buttonClass = [
    'group flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-all hover:scale-105 hover:border-white/40 hover:bg-black/70',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      onClick={onClick}
      className={buttonClass}
      title="Reset view (ESC)"
      aria-label="Reset view"
    >
      <svg
        className="h-6 w-6 transition-transform group-hover:scale-110"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </button>
  )
}

export default ResetButton
