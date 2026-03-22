interface KolrabeeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'light' | 'dark'
  className?: string
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
}

export default function KolrabeeLogo({ size = 'md', variant = 'light', className = '' }: KolrabeeLogoProps) {
  const isDark = variant === 'dark'
  return (
    <span className={`font-display font-black uppercase tracking-tight ${sizeClasses[size]} ${className}`}>
      <span className={isDark ? 'text-white' : 'text-forge'}>kol</span>
      <span className="text-ember">ra</span>
      <span className={isDark ? '' : 'text-forest'} style={isDark ? { color: '#4BBF6B' } : undefined}>bee</span>
    </span>
  )
}
