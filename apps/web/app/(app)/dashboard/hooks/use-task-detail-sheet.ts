'use client'

import { useState, useCallback } from 'react'

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
}

export function useTaskDetailSheet() {
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback((todo: TodoItem) => {
    setSelectedTodo(todo)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Clear after animation completes
    setTimeout(() => setSelectedTodo(null), 200)
  }, [])

  return { selectedTodo, isOpen, open, close }
}
