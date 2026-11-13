import { AdminApp } from './ui/AdminApp'
import { Login } from './ui/Login'
import { hasSession } from '@/admin/security'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  return (await hasSession()) ? <AdminApp /> : <Login />
}
