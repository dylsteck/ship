'use client'

import { DashboardClientShell } from './components/dashboard-client-shell'
import { setApiToken } from '@/lib/api/configure'
import { SessionControllerProvider } from '@/lib/realtime/session-controller-provider'
import { ShellProvider } from '@/lib/realtime/shell-provider'
import {
  useDashboardClientView,
  type DashboardClientViewParams,
} from './hooks/use-dashboard-client-view'

export function DashboardClient(props: DashboardClientViewParams) {
  if (props.apiToken) setApiToken(props.apiToken)

  return (
    <ShellProvider sessions={props.sessions}>
      <SessionControllerProvider>
        <DashboardClientView {...props} />
      </SessionControllerProvider>
    </ShellProvider>
  )
}

function DashboardClientView(props: DashboardClientViewParams) {
  const view = useDashboardClientView(props)

  return (
    <DashboardClientShell
      user={view.user}
      serverTimestamp={view.serverTimestamp}
      isMobile={view.isMobile ?? false}
      chat={view.chat}
      state={view.state}
      derived={view.derived}
      streamingSessionIds={view.streamingSessionIds}
      rightSidebar={view.rightSidebar}
      rightSidebarData={view.rightSidebarData}
      mutateSessions={view.dataHooks.mutateSessions}
      models={view.dataHooks.models}
      promptHandlers={view.promptHandlers}
      handleRetryLastMessage={view.handleRetryLastMessage}
    />
  )
}
