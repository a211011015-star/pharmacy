import React, { createContext, useContext, useMemo, useRef, useState } from 'react'
const Ctx = createContext(null)

function beep(enabled=true){
  if(!enabled) return
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)()
    const o=ctx.createOscillator(); const g=ctx.createGain()
    o.type='sine'; o.frequency.value=880; g.gain.value=0.035
    o.connect(g); g.connect(ctx.destination)
    o.start(); setTimeout(()=>{o.stop();ctx.close()},90)
  }catch{}
}

export function ToastProvider({children}){
  const [toasts,setToasts]=useState([])
  const beepEnabled=useRef(true)

  const api=useMemo(()=>({
    setBeepEnabled(v){beepEnabled.current=!!v},
    show({titleAr='تنبيه',titleEn='Notice',ar='',en='',ttl=3500}){
      const id=Math.random().toString(16).slice(2)
      setToasts(t=>[{id,titleAr,titleEn,ar,en},...t].slice(0,3))
      beep(beepEnabled.current)
      setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),ttl)
    }
  }),[])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toastWrap">
        {toasts.map(t=>(
          <div key={t.id} className="toast">
            <div className="toastTitle">{t.titleAr} / {t.titleEn}</div>
            <div className="toastLine">{t.ar}</div>
            <div className="toastLine">{t.en}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
export function useToast(){return useContext(Ctx)}
