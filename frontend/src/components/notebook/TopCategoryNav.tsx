import React from 'react'
import type { NotebookCategory } from '../../api/recommendationsCenter'
import './notebook.css'

interface TopCategoryNavProps {
  categories: NotebookCategory[]
  selectedCategoryId: string | null
  onSelectCategory: (categoryId: string) => void
  onMobileMenuToggle: () => void
  children?: React.ReactNode
}

export default function TopCategoryNav({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onMobileMenuToggle,
  children,
}: TopCategoryNavProps) {
  return (
    <nav className="nb-topnav">
      <button className="nb-mobile-menu-btn" onClick={onMobileMenuToggle} title="目录">
        ☰
      </button>

      <button
        className={`nb-topnav-item${selectedCategoryId === '__all__' ? ' nb-topnav-item--active' : ''}`}
        onClick={() => onSelectCategory('__all__')}
      >
        首页
      </button>

      {categories.map(cat => (
        <button
          key={cat.id}
          className={`nb-topnav-item${selectedCategoryId === cat.id ? ' nb-topnav-item--active' : ''}`}
          onClick={() => onSelectCategory(cat.id)}
        >
          {cat.title}
        </button>
      ))}

      <div className="nb-topnav-spacer" />
      <div className="nb-topnav-actions">
        {children}
      </div>
    </nav>
  )
}
