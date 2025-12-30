import React from 'react'
import { useI18n } from '../state/i18n'

export function LanguageToggle(){
  const { lang, setLang } = useI18n()
  return (
    <select className="select" value={lang} onChange={(e)=>setLang(e.target.value)} style={{width:120}}>
      <option value="en">EN</option>
      <option value="ar">AR</option>
      <option value="ku">KU</option>
    </select>
  )
}
