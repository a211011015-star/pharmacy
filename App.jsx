import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from './state/auth'
import { useI18n } from './state/i18n'
import { getHashPath, nav } from './ui/route'
import { Sidebar } from './layout/Sidebar'
import { Topbar } from './layout/Topbar'
import { LoginPage } from './pages/Login'
import { DashboardPage } from './pages/Dashboard'
import { POSPage } from './pages/POS'
import { ProductsPage } from './pages/Products'
import { ScientificsPage } from './pages/Scientifics'
import { InventoryPage } from './pages/Inventory'
import { PurchasesPage } from './pages/Purchases'
import { SuppliersPage } from './pages/Suppliers'
import { TransfersPage } from './pages/Transfers'
import { TimelinePage } from './pages/Timeline'
import { ReportsPage } from './pages/Reports'
import { CashClosePage } from './pages/CashClose'
import { UsersPermissionsPage } from './pages/UsersPermissions'
import { SettingsPage } from './pages/Settings'
import { PrintDesignerPage } from './pages/PrintDesigner'
import { AboutPage } from './pages/About'

export function App(){
  const { session, loading } = useAuth()
  const [path, setPath] = useState(getHashPath())
  const { dir } = useI18n()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('qatfah.sidebarCollapsed') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('qatfah.sidebarCollapsed', sidebarCollapsed ? '1' : '0') } catch {}
  }, [sidebarCollapsed])

  useEffect(()=>{
    const onHash=()=>setPath(getHashPath())
    window.addEventListener('hashchange', onHash)
    return ()=>window.removeEventListener('hashchange', onHash)
  },[])

  useEffect(()=>{ if(!window.location.hash) nav('/dashboard') },[])

  const Page = useMemo(()=>{
    switch(path){
      case '/dashboard': return <DashboardPage/>
      case '/pos': return <POSPage/>
      case '/products': return <ProductsPage/>
      case '/scientifics': return <ScientificsPage/>
      case '/inventory': return <InventoryPage/>
      case '/purchases': return <PurchasesPage/>
      case '/suppliers': return <SuppliersPage/>
      case '/transfers': return <TransfersPage/>
      case '/timeline': return <TimelinePage/>
      case '/reports': return <ReportsPage/>
      case '/cash-close': return <CashClosePage/>
      case '/users': return <UsersPermissionsPage/>
      case '/settings': return <SettingsPage/>
      case '/print-designer': return <PrintDesignerPage/>
      case '/about': return <AboutPage/>
      default: return <DashboardPage/>
    }
  },[path])

  if(loading) return <div className="container"><div className="card"><div className="cardBody">Loading…</div></div></div>
  if(!session) return <LoginPage/>

  return (
    <div dir={dir}>
      <Sidebar path={path} collapsed={sidebarCollapsed} onToggle={()=>setSidebarCollapsed(v=>!v)} />
      <div className={sidebarCollapsed ? "main mainCollapsed" : "main"}>
        <div className="card" style={{borderRadius:0,borderLeft:0,borderRight:0}}>
          <Topbar/>
        </div>
        <div className="container">{Page}</div>
      </div>
    </div>
  )
}
