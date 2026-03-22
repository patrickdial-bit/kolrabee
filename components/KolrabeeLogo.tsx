interface KolrabeeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
}

export default function KolrabeeLogo({ size = 'md', className = '' }: KolrabeeLogoProps) {
  return (
    <span className={`font-display font-black uppercase tracking-tight ${sizeClasses[size]} ${className}`}>
      <span className="text-forge">kol</span>
      <span className="text-ember">ra</span>
      <span className="text-forest">bee</span>
    </span>
  )
}
