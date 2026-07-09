import React from 'react'
import './notebook.css'

interface NotebookLayoutProps {
  sidebar: React.ReactNode
  article: React.ReactNode
  toc: React.ReactNode
}

export default function NotebookLayout({ sidebar, article, toc }: NotebookLayoutProps) {
  return (
    <div className="nb-layout">
      {sidebar}
      {article}
      {toc}
    </div>
  )
}
