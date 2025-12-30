import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../state/auth'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'

export function TimelinePage(){
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const { lang, t } = useI18n()
  const [rows,setRows]=useState([])

  async function load(){
    if(!activeBranchId) return
    const r = await supabase
      .from('timeline_events')
      .select('id,event_type,ref,message_ar,message_en,created_at,payload')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:false})
      .limit(200)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setRows(r.data||[])
  }

  useEffect(()=>{ load() },[activeBranchId])

  return (
    <div className="card">
      <div className="cardHeader row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:900}}>{t.timeline}</div>
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      <div className="cardBody" style={{maxHeight:620,overflow:'auto'}}>
        {rows.map(r=>(
          <div key={r.id} className="card" style={{marginBottom:10}}>
            <div className="cardBody">
              <div className="row" style={{justifyContent:'space-between'}}>
                <div style={{fontWeight:800}}>{r.event_type}{r.ref ? ` • ${r.ref}` : ''}</div>
                <div className="hint">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <div style={{marginTop:6}}>
                <div>{lang==='ar' ? (r.message_ar||r.message_en||'') : (r.message_en||r.message_ar||'')}</div>
              </div>
            </div>
          </div>
        ))}
        {!rows.length && <div className="hint">No events.</div>}
      </div>
    </div>
  )
}
