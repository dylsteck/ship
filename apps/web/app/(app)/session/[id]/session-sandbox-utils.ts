export function normalizeSandboxStatus(status: string | null | undefined): 'provisioning' | 'ready' | 'error' | 'none' {
  switch (status) {
    case 'active':
      return 'ready'
    case 'paused':
    case 'terminated':
      return 'none'
    case 'error':
    case 'provisioning':
    case 'ready':
    case 'none':
      return status
    default:
      return 'none'
  }
}
