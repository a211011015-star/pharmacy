import React, { useEffect, useState } from 'react'
import { useAuth } from '../state/auth'
import { useI18n } from '../state/i18n'
import { LanguageToggle } from '../ui/LanguageToggle'

export function Topbar(){
  const { signOut, branches, activeBranchId, setActiveBranchId } = useAuth()
  const { t } = useI18n()

  const [theme,setTheme]=useState(()=>localStorage.getItem('qatfah_theme')||'dark')
  useEffect(()=>{
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
    localStorage.setItem('qatfah_theme', theme)
  },[theme])

  return (
    <div className="topbar">
      <div className="row" style={{gap:10,flexWrap:'wrap'}}>
        <span className="badge">{t.branch}</span>
        <select className="select" style={{width:240}} value={activeBranchId||''} onChange={(e)=>setActiveBranchId(e.target.value)}>
          {branches.map(x=><option key={x.id} value={x.id}>{x.name_ar || x.name_en}</option>)}
        </select>
      </div>

      <div className="row" style={{gap:10,flexWrap:'wrap'}}>
        <button className="btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>
          {theme==='dark' ? 'Light' : 'Dark'}
        </button>
        <LanguageToggle />
        <button className="btn btnDanger" onClick={signOut}>{t.signOut}</button>
      </div>
    </div>
  )
}
