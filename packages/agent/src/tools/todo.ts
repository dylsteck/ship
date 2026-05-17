/**
 * `todo_write` — record/update the agent's plan as a list of todos.
 *
 * The list is ephemeral within a turn (the host transcribes it for the UI
 * via the standard tool result chunk). Status values mirror the UI's
 * existing todo widget so the side panel just works.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'

const todoStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'cancelled'])

const todoItemSchema = z.object({
  id: z.string().min(1).describe('Stable id for this item across updates'),
  content: z.string().min(1).describe('Short, action-oriented description'),
  status: todoStatusEnum,
})

export type TodoStatus = z.infer<typeof todoStatusEnum>
export type TodoItem = z.infer<typeof todoItemSchema>

const todoInputSchema = z.object({
  todos: z.array(todoItemSchema).min(1).describe('Full list (REPLACES previous list)'),
  merge: z
    .boolean()
    .optional()
    .describe('When true, merge by id with existing list instead of replacing'),
})

/**
 * Build the `todo_write` tool.
 *
 * @remarks
 * The host is responsible for surfacing the latest list to the UI. We just
 * echo the structured value so the AI SDK chunk stream carries it.
 */
export const todoWriteTool = () =>
  tool({
    description: [
      'Record/update the agent plan as a list of todos.',
      'GUIDELINES:',
      '- Use proactively for tasks with 3+ steps.',
      '- Keep at most ONE item in `in_progress` at a time.',
      '- Pass the full list each call (or use merge=true to update by id).',
    ].join('\n'),
    inputSchema: todoInputSchema,
    execute: async ({ todos, merge }) => {
      return {
        ok: true as const,
        merge: merge === true,
        todos,
      }
    },
  })
