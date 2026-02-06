import { redirect } from 'next/navigation'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params
  redirect(`/?session=${id}`)
}
