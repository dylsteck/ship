import { notFound } from 'next/navigation'
import { getServerSession } from '@/lib/session/get-server-session'
import { RepoPageClient } from '@/components/repo-page-client'

interface PageProps {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoPage({ params }: PageProps) {
  const { owner, repo } = await params
  const session = await getServerSession()

  if (!session?.user?.id) {
    notFound()
  }

  return <RepoPageClient owner={owner} repo={repo} />
}
