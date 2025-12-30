import React, { forwardRef, useState } from 'react'
import { useI18n } from '../state/i18n'

export const BarcodeInput = forwardRef(function BarcodeInput({ onScan, placeholder, autoClear=true }, ref){
  const { t } = useI18n()
  const [v,setV]=useState('')

  return (
    <input
      ref={ref}
      className="input"
      value={v}
      onChange={(e)=>setV(e.target.value)}
      placeholder={placeholder || t.barcode}
      onKeyDown={(e)=>{
        if(e.key==='Enter'){
          const code = v.trim()
          if(code){
            onScan?.(code)
            if(autoClear) setV('')
          }
        }
      }}
      style={{width:210}}
    />
  )
})
