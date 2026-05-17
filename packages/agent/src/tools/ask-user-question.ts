/**
 * `ask_user_question` — pause the agent and ask the user a question.
 *
 * The host surfaces the question through the chat UI. The model receives
 * the answer in a follow-up turn, so the tool itself simply records the
 * question; the run loop interprets it as a "needs user reply" boundary.
 *
 * @packageDocumentation
 */

import { tool } from 'ai'
import { z } from 'zod'

const askInputSchema = z.object({
  question: z.string().min(1).describe('Concise, single-question prompt for the user'),
  options: z
    .array(z.string().min(1))
    .max(8)
    .optional()
    .describe('Optional short answer options the user can pick from'),
})

/**
 * Build the `ask_user_question` tool.
 *
 * @remarks
 * Only call when blocked on real ambiguity. The agent loop ends the turn
 * when this is the last call so the user can answer.
 */
export const askUserQuestionTool = () =>
  tool({
    description: [
      'Ask the user a question and wait for their reply.',
      'WHEN TO USE:',
      '- The next step requires a decision only the user can make.',
      'WHEN NOT TO USE:',
      '- You can plausibly figure it out from existing context or tools.',
    ].join('\n'),
    inputSchema: askInputSchema,
    execute: async ({ question, options }) => {
      return {
        ok: true as const,
        question,
        options: options ?? null,
        awaitingUser: true as const,
      }
    },
  })
