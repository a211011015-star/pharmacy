import React from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  PackagePlus,
  Truck,
  Repeat,
  Clock,
  Boxes,
  Stethoscope,
  BarChart3,
  Wallet,
  Settings,
  Info,
  Shield,
} from 'lucide-react'
import { useI18n } from '../state/i18n'

function Item({ href, label, Icon, active, collapsed }) {
  return (
    <a className={active ? 'navItem navItemActive' : 'navItem'} href={href} title={label}>
      <span className="navIcon"><Icon size={18} /></span>
      {!collapsed && <span className="navLabel">{label}</span>}
    </a>
  )
}

export function Sidebar({ path, collapsed, onToggle }) {
  const { t } = useI18n()

  return (
    <aside className={collapsed ? 'sidebar sidebarCollapsed' : 'sidebar'}>
      <div className="sideBrand">
        <div className="sideBrandRow">
          <div className="sideLogo">Q</div>
          {!collapsed && (
            <div>
              <div className="sideTitle">Qatfah</div>
              <div className="sideSub">PRO</div>
            </div>
          )}
        </div>

        <button className="sideToggle" onClick={onToggle} title={collapsed ? 'Show' : 'Hide'}>
          |||
        </button>
      </div>

      <div className="nav">
        <Item href="#/dashboard" label={t.dashboard} Icon={LayoutDashboard} active={path === '/dashboard'} collapsed={collapsed} />
        <Item href="#/pos" label={t.pos} Icon={ShoppingCart} active={path === '/pos'} collapsed={collapsed} />
        <Item href="#/products" label={t.products} Icon={Package} active={path === '/products'} collapsed={collapsed} />
        <Item href="#/purchases" label={t.purchases} Icon={PackagePlus} active={path === '/purchases'} collapsed={collapsed} />
        <Item href="#/suppliers" label={t.suppliers} Icon={Truck} active={path === '/suppliers'} collapsed={collapsed} />
        <Item href="#/transfers" label={t.transfers} Icon={Repeat} active={path === '/transfers'} collapsed={collapsed} />
        <Item href="#/timeline" label={t.timeline} Icon={Clock} active={path === '/timeline'} collapsed={collapsed} />
        <Item href="#/inventory" label={t.inventory} Icon={Boxes} active={path === '/inventory'} collapsed={collapsed} />
        <Item href="#/scientifics" label={t.scientifics} Icon={Stethoscope} active={path === '/scientifics'} collapsed={collapsed} />
        <Item href="#/reports" label={t.reports} Icon={BarChart3} active={path === '/reports'} collapsed={collapsed} />
        <Item href="#/cash-close" label={t.cashClose} Icon={Wallet} active={path === '/cash-close'} collapsed={collapsed} />
        <Item href="#/users" label={t.users} Icon={Shield} active={path === '/users'} collapsed={collapsed} />
        <Item href="#/settings" label={t.settings} Icon={Settings} active={path === '/settings'} collapsed={collapsed} />
        <Item href="#/about" label={t.about} Icon={Info} active={path === '/about'} collapsed={collapsed} />
      </div>
    </aside>
  )
}
