import { atom } from 'jotai'

// Atom for storing task prompt during form submission
export const taskPromptAtom = atom<string>('')
