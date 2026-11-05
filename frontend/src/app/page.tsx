import { ApiStatusIndicator } from './api-status'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Knut vandrar</h1>
      <p className="mt-4 text-muted-foreground">A Full Stack Application</p>
      <ApiStatusIndicator />
    </main>
  )
}
