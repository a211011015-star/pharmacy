import React, { useEffect, useState } from 'react'
import { useAuth } from '../state/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { money } from '../ui/format'

export function CashClosePage(){
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const [openingCash,setOpeningCash]=useState(0)
  const [countedCash,setCountedCash]=useState(0)
  const [session,setSession]=useState(null)

  useEffect(()=>{loadOpen()},[activeBranchId])
  async function loadOpen(){
    if(!activeBranchId) return
    const { data } = await supabase.from('cash_drawer_sessions').select('*').eq('branch_id',activeBranchId).eq('status','open').order('opened_at',{ascending:false}).limit(1)
    setSession((data||[])[0]||null)
  }
  async function open(){
    const { error } = await supabase.rpc('open_cash_drawer',{p_payload:{branch_id:activeBranchId,opening_cash:Number(openingCash||0)}})
    if(error) toast.show({titleAr:'فشل',titleEn:'Failed',ar:error.message,en:error.message})
    else{toast.show({titleAr:'تم',titleEn:'OK',ar:'تم فتح الصندوق',en:'Opened'});loadOpen()}
  }
  async function close(){
    if(!session) return
    const { data, error } = await supabase.rpc('close_cash_drawer',{p_payload:{branch_id:activeBranchId,session_id:session.id,counted_cash:Number(countedCash||0)}})
    if(error) toast.show({titleAr:'فشل',titleEn:'Failed',ar:error.message,en:error.message})
    else{toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الإغلاق. الفرق: '+money(data.difference),en:'Closed. Diff: '+data.difference});setSession(null);loadOpen()}
  }

  return (
    <div className="grid grid2">
      <div className="card"><div className="cardHeader">Open Drawer</div><div className="cardBody">
        <div className="label">Opening cash</div>
        <input className="input" value={openingCash} onChange={e=>setOpeningCash(e.target.value)}/>
        <button className="btn btnPrimary" style={{marginTop:12}} onClick={open}>Open</button>
      </div></div>

      <div className="card"><div className="cardHeader">Close Drawer</div><div className="cardBody">
        {session?(
          <div className="col">
            <div className="badge">Session: {session.id}</div>
            <div className="hint">Expected: {money(session.expected_cash)}</div>
            <div className="label">Counted cash</div>
            <input className="input" value={countedCash} onChange={e=>setCountedCash(e.target.value)}/>
            <button className="btn btnPrimary" onClick={close}>Close</button>
            <button className="btn" onClick={()=>window.print()}>Print</button>
          </div>
        ):<div className="hint">لا توجد جلسة مفتوحة.</div>}
      </div></div>
    </div>
  )
}
