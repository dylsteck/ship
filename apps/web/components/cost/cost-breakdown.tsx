'use client'

import type { CostBreakdown } from '@/lib/cost-tracker'

interface CostBreakdownProps {
  breakdown?: CostBreakdown
  breakdowns?: CostBreakdown[]
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`
}

function formatTokens(value: number): string {
  return value.toLocaleString()
}

export function CostBreakdown({ breakdown, breakdowns }: CostBreakdownProps) {
  const items = breakdowns || (breakdown ? [breakdown] : [])

  if (items.length === 0) {
    return null
  }

  return (
    <div className="mt-2 border rounded-lg overflow-hidden dark:border-gray-700">
      <div className="px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
        Cost Breakdown
      </div>
      <div className="p-3 space-y-3 bg-white dark:bg-gray-900">
        {items.map((item, index) => (
          <div key={item.taskId || index} className="space-y-1">
            {items.length > 1 && (
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Task: {item.taskId}</div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Model:</span>
                <span className="ml-1 font-mono text-gray-700 dark:text-gray-200">{item.model}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                <span className="ml-1 font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(item.estimatedCost)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Input tokens:</span>
                <span className="ml-1 font-mono text-gray-700 dark:text-gray-200">
                  {formatTokens(item.inputTokens)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 dark:text-gray-400">Output tokens:</span>
                <span className="ml-1 font-mono text-gray-700 dark:text-gray-200">
                  {formatTokens(item.outputTokens)}
                </span>
              </div>
            </div>
          </div>
        ))}
        {items.length > 1 && (
          <div className="pt-2 border-t dark:border-gray-700">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Total:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(items.reduce((sum, item) => sum + item.estimatedCost, 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
