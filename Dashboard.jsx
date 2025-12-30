import React, { useEffect, useState } from 'react'
import { useI18n } from '../state/i18n'
import { useAuth } from '../state/auth'
import { supabase } from '../lib/supabase'

function BigCard({href,title,subtitle,icon,accent=false,onClick}){
  const style = accent ? {background:'rgba(23,185,170,.10)',border:'1px solid rgba(23,185,170,.25)'} : {}
  const inner = (
    <div className="cardBody" style={{textAlign:'center',padding:22}}>
      <div style={{fontSize:42,fontWeight:900,marginBottom:10}}>{icon}</div>
      <div style={{fontSize:18,fontWeight:900}}>{title}</div>
      <div className="hint" style={{marginTop:6}}>{subtitle}</div>
    </div>
  )
  if(onClick) return <button className="card" onClick={onClick} style={{width:220,...style}}>{inner}</button>
  return <a className="card" href={href} style={{width:220,textDecoration:'none',...style}}>{inner}</a>
}

export function DashboardPage(){
  const { t } = useI18n()
  const { signOut, activeBranchId } = useAuth()

  const [cash,setCash]=useState({open:false, expected:null})
  const [nearExpiry,setNearExpiry]=useState([])

  useEffect(()=>{ loadCash() },[activeBranchId])

  async function loadCash(){
    if(!activeBranchId) return
    // lightweight hint: is there an open drawer session?
    const r = await supabase
      .from('cash_drawer_sessions')
      .select('id,status,expected_cash')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:false})
      .limit(1)
    if(r.error) return
    const last = r.data?.[0]
    setCash({
      open: last?.status === 'open',
      expected: last?.expected_cash ?? null
    })

  // Near expiry (<= 90 days)
  const until = new Date()
  until.setDate(until.getDate() + 90)
  const r2 = await supabase
    .from('inventory_batches')
    .select('id,expiry_date,qty_on_hand, products(trade_name_en,strength)')
    .eq('branch_id', activeBranchId)
    .gt('qty_on_hand', 0)
    .not('expiry_date','is',null)
    .lte('expiry_date', until.toISOString().slice(0,10))
    .order('expiry_date',{ascending:true})
    .limit(20)
  if(!r2.error) setNearExpiry(r2.data||[])

}

return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">{t.dashboard}</div>
        <div className="cardBody">
          <div className="row" style={{gap:14,flexWrap:'wrap'}}>
            <BigCard href="#/pos" title={t.pos} subtitle="Quick sell" icon="◎" accent />
            <BigCard href="#/inventory" title={t.inventory} subtitle="Batches & expiry" icon="▤" />
            <BigCard href="#/cash-close" title={t.cashClose} subtitle={cash.open ? 'Open session' : 'No open session'} icon="₪" />
            <BigCard href="#/settings" title={t.settings} subtitle="Currency & print" icon="⚙" />
            <BigCard onClick={signOut} title={t.signOut} subtitle="Logout" icon="⎋" />
          </div>

          {nearExpiry.length>0 && (
            <div className="card" style={{marginTop:14}}>
              <div className="cardHeader" style={{fontWeight:900}}>{t.expirySoon}</div>
              <div className="cardBody" style={{overflow:'auto'}}>
                <table className="table">
                  <thead><tr><th>Product</th><th style={{width:140}}>Exp</th><th style={{width:120}}>Qty</th></tr></thead>
                  <tbody>
                    {nearExpiry.map(b=>(
                      <tr key={b.id}>
                        <td className="hint">{b.products?.trade_name_en} {b.products?.strength?`• ${b.products.strength}`:''}</td>
                        <td className="hint">{b.expiry_date}</td>
                        <td className="hint">{b.qty_on_hand}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{marginTop:18,textAlign:'center'}}>
            <div style={{fontWeight:900}}>قطفة لإدارة الصيدليات - الصيدلاني أسامة فتحي محمد</div>
          </div>
        </div>
      </div>
    </div>
  )
}
