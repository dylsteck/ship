'use client'

import { useEffect, useState, useTransition } from 'react'
import { ModelSelector, ModelBadge, type ModelInfo } from '@/components/model/model-selector'
import { ConnectorSettings } from '@/components/settings/connector-settings'
import { Button } from '@/components/ui/button'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

interface SettingsClientProps {
  userId: string
}

export function SettingsClient({ userId }: SettingsClientProps) {
  const [defaultModel, setDefaultModel] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Fetch default model and available models
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)

        // Fetch default model
        const defaultRes = await fetch(`${API_URL}/models/default?userId=${userId}`)
        if (!defaultRes.ok) throw new Error('Failed to fetch default model')
        const defaultData = await defaultRes.json()
        setDefaultModel(defaultData.model)
        setSelectedModel(defaultData.model)

        // Fetch available models
        const modelsRes = await fetch(`${API_URL}/models/available`)
        if (!modelsRes.ok) throw new Error('Failed to fetch available models')
        const modelsData = await modelsRes.json()
        setAvailableModels(modelsData)
      } catch (err) {
        console.error('Error loading settings:', err)
        setError(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [userId])

  const handleSave = () => {
    startTransition(async () => {
      try {
        setSaveSuccess(false)
        setError(null)

        const res = await fetch(`${API_URL}/models/default`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, model: selectedModel }),
        })

        if (!res.ok) throw new Error('Failed to save default model')

        setDefaultModel(selectedModel)
        setSaveSuccess(true)

        // Clear success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
      } catch (err) {
        console.error('Error saving settings:', err)
        setError(err instanceof Error ? err.message : 'Failed to save settings')
      }
    })
  }

  const hasChanges = selectedModel !== defaultModel

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your preferences and default configurations
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="border-b pb-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI Model</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Choose your default AI model for agent tasks. You can override this when creating a session.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="model-select"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Default Model
              </label>
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                availableModels={availableModels}
                disabled={isPending}
              />
            </div>

            {selectedModel && (
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Current selection:</div>
                <ModelBadge
                  modelId={selectedModel}
                  modelName={availableModels.find((m) => m.id === selectedModel)?.name}
                />
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            )}

            {saveSuccess && (
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                <p className="text-sm text-green-800 dark:text-green-400">Settings saved successfully!</p>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={!hasChanges || isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="border-b pb-4 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Integrations</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Connect and manage your external service integrations
            </p>
          </div>

          <div className="mt-6">
            <ConnectorSettings userId={userId} />
          </div>
        </div>
      </div>
    </div>
  )
}
