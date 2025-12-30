import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../state/auth'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { BarcodeInput } from '../ui/BarcodeInput'

function money(n){
  const x = Number(n||0)
  if(Number.isNaN(x)) return '0.00'
  return x.toFixed(2)
}

function emptyLine(){ return { barcode:'', product_id:'', name:'', qty:'1' } }

export function TransfersPage(){
  const { activeBranchId, branches } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const [toBranch,setToBranch]=useState('')
  const [note,setNote]=useState('')
  const [lines,setLines]=useState([emptyLine()])
  const [history,setHistory]=useState([])

  const [balances,setBalances]=useState([])
  const [settleOpen,setSettleOpen]=useState(false)
  const [settleDir,setSettleDir]=useState('pay')
  const [settleOther,setSettleOther]=useState('')
  const [settleAmount,setSettleAmount]=useState('')
  const [settleNote,setSettleNote]=useState('')

  useEffect(()=>{
    if(branches?.length && !toBranch){
      const other = branches.find(b=>b.id!==activeBranchId)
      if(other) setToBranch(other.id)
    }
  },[branches,activeBranchId])

  async function loadHistory(){
    if(!activeBranchId) return
    const r = await supabase
      .from('stock_transfers')
      .select('id,ref,status,from_branch_id,to_branch_id,total_value,created_at')
      .or(`from_branch_id.eq.${activeBranchId},to_branch_id.eq.${activeBranchId}`)
      .order('created_at',{ascending:false})
      .limit(200)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setHistory(r.data||[])
  }
  useEffect(()=>{ loadHistory() },[activeBranchId])

  async function loadBalances(){
    if(!activeBranchId) return
    const r = await supabase.rpc('get_branch_balances', { p_branch_id: activeBranchId })
    if(r.error) return
    setBalances(r.data||[])
  }
  useEffect(()=>{ loadBalances() },[activeBranchId])

  async function scan(idx, code){
    if(!activeBranchId) return
    const r = await supabase.rpc('find_product_by_barcode', { p_branch_id: activeBranchId, p_barcode: code })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    const f=r.data?.[0]
    if(!f) return toast.show({titleAr:'غير موجود',titleEn:'Not found',ar:'لا يوجد هذا الباركود',en:'Barcode not found'})
    setLines(prev=>{
      const next=[...prev]
      next[idx]={...next[idx], barcode:code, product_id:f.product_id, name:f.trade_name_en, qty: next[idx].qty||'1'}
      return next
    })
  }

  function addLine(){ setLines(prev=>[...prev, emptyLine()]) }
  function removeLine(i){ setLines(prev=> prev.length===1 ? prev : prev.filter((_,idx)=>idx!==i)) }

  async function send(){
    if(!activeBranchId) return
    if(!toBranch) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اختر فرع الاستلام',en:'Select destination branch'})
    const items = lines
      .filter(l=>l.product_id && Number(l.qty||0)>0)
      .map(l=>({product_id:l.product_id, qty:Number(l.qty)}))
    if(!items.length) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'أضف مواد للتحويل',en:'Add items'})

    const payload={
      from_branch_id: activeBranchId,
      to_branch_id: toBranch,
      note: note || null,
      items
    }
    const r = await supabase.rpc('transfer_stock', { p_payload: payload })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    if(!r.data?.ok) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:JSON.stringify(r.data),en:JSON.stringify(r.data)})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم التحويل: '+r.data.ref,en:'Transferred: '+r.data.ref})
    setLines([emptyLine()])
    setNote('')
    loadHistory()
    loadBalances()
  }

  async function settle(){
    if(!activeBranchId) return
    const other = settleOther
    const amt = Number(settleAmount||0)
    if(!other) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اختر الفرع',en:'Select branch'})
    if(!(amt>0)) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'أدخل مبلغ صحيح',en:'Enter valid amount'})

    const payload = {
      from_branch_id: settleDir==='pay' ? activeBranchId : other,
      to_branch_id: settleDir==='pay' ? other : activeBranchId,
      amount: amt,
      note: settleNote || null,
    }
    const r = await supabase.rpc('settle_branch_balance', { p_payload: payload })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    if(!r.data?.ok) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:JSON.stringify(r.data),en:JSON.stringify(r.data)})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم إنشاء وصل: '+r.data.ref,en:'Voucher: '+r.data.ref})
    setSettleOpen(false)
    setSettleAmount('')
    setSettleNote('')
    loadBalances()
  }

  const branchOptions = (branches||[]).filter(b=>b.id!==activeBranchId)

  const balanceSummary = useMemo(()=>{
    const owedToMe = balances.reduce((s,b)=> s + (Number(b.balance||0)>0 ? Number(b.balance) : 0), 0)
    const iOwe = balances.reduce((s,b)=> s + (Number(b.balance||0)<0 ? Math.abs(Number(b.balance)) : 0), 0)
    return { owedToMe, iOwe }
  },[balances])

  return (
    <div className="col">

      <div className="card">
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>Branch balance</div>
          <div className="row" style={{gap:10}}>
            <button className="btn" onClick={loadBalances}>Refresh</button>
            <button className="btn btnPrimary" onClick={()=>{
              const other = branchOptions?.[0]?.id || ''
              setSettleOther(other)
              setSettleDir('pay')
              setSettleOpen(true)
            }}>Voucher</button>
          </div>
        </div>
        <div className="cardBody">
          <div className="grid grid3">
            <div className="card" style={{margin:0}}>
              <div className="cardBody">
                <div className="hint">Owed to me</div>
                <div className="kpi">{money(balanceSummary.owedToMe)}</div>
              </div>
            </div>
            <div className="card" style={{margin:0}}>
              <div className="cardBody">
                <div className="hint">I owe</div>
                <div className="kpi">{money(balanceSummary.iOwe)}</div>
              </div>
            </div>
            <div className="card" style={{margin:0}}>
              <div className="cardBody">
                <div className="hint">Net</div>
                <div className="kpi">{money(balanceSummary.owedToMe - balanceSummary.iOwe)}</div>
              </div>
            </div>
          </div>

          <div style={{marginTop:10, overflow:'auto'}}>
            <table className="table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th style={{width:180}}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b,idx)=>(
                  <tr key={idx}>
                    <td className="hint">{b.counterparty_name_ar || b.counterparty_name_en || b.counterparty_branch_id}</td>
                    <td>
                      <b style={{color:Number(b.balance||0)>=0? 'var(--teal)' : 'var(--danger)'}}>
                        {money(b.balance)}
                      </b>
                    </td>
                  </tr>
                ))}
                {!balances.length && <tr><td colSpan={2} className="hint">No balances.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{t.transfers}</div>
          <button className="btn" onClick={loadHistory}>Refresh</button>
        </div>
        <div className="cardBody">

          <div className="grid grid2">
            <div>
              <div className="label">From</div>
              <div className="hint">{activeBranchId || '—'}</div>
            </div>
            <div>
              <div className="label">To</div>
              <select className="select" value={toBranch} onChange={e=>setToBranch(e.target.value)} style={{width:'100%'}}>
                <option value="">—</option>
                {branchOptions.map(b=><option key={b.id} value={b.id}>{b.name_ar} / {b.name_en}</option>)}
              </select>
            </div>
          </div>

          <div style={{marginTop:10}}>
            <div className="label">Note</div>
            <input className="input" value={note} onChange={e=>setNote(e.target.value)} />
          </div>

          <div style={{marginTop:12}}>
            <div className="row" style={{justifyContent:'space-between'}}>
              <div style={{fontWeight:800}}>Items</div>
              <button className="btn" onClick={addLine}>+ Add</button>
            </div>

            <table className="table" style={{marginTop:8}}>
              <thead>
                <tr>
                  <th style={{width:190}}>{t.barcode}</th>
                  <th>Product</th>
                  <th style={{width:140}}>{t.qty}</th>
                  <th style={{width:110}}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l,idx)=>(
                  <tr key={idx}>
                    <td>
                      <div className="row" style={{gap:8}}>
                        <input className="input" value={l.barcode} onChange={e=>setLines(prev=>{const n=[...prev]; n[idx]={...n[idx],barcode:e.target.value}; return n})} />
                        <BarcodeInput onScan={(c)=>scan(idx,c)} />
                      </div>
                    </td>
                    <td className="hint">{l.name||'—'}</td>
                    <td>
                      <input className="input" value={l.qty} onChange={e=>setLines(prev=>{const n=[...prev]; n[idx]={...n[idx],qty:e.target.value}; return n})} />
                    </td>
                    <td>
                      <button className="btn btnDanger" onClick={()=>removeLine(idx)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row" style={{gap:10,marginTop:12}}>
            <button className="btn btnPrimary" onClick={send}>Send transfer</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">Recent transfers</div>
        <div className="cardBody" style={{maxHeight:420,overflow:'auto'}}>
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Status</th>
                <th>From</th>
                <th>To</th>
                <th>Value</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h=>(
                <tr key={h.id}>
                  <td><b>{h.ref}</b></td>
                  <td className="hint">{h.status}</td>
                  <td className="hint">{h.from_branch_id}</td>
                  <td className="hint">{h.to_branch_id}</td>
                  <td className="hint">{money(h.total_value)}</td>
                  <td className="hint">{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={6} className="hint">No transfers.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {settleOpen && (
        <div className="modalOverlay" onMouseDown={()=>setSettleOpen(false)}>
          <div className="modal" onMouseDown={e=>e.stopPropagation()}>
            <div className="modalHeader">Settlement voucher</div>
            <div className="modalBody">
              <div className="row" style={{gap:10,flexWrap:'wrap'}}>
                <button className={settleDir==='pay' ? 'chip chipOn' : 'chip'} onClick={()=>setSettleDir('pay')}>Pay</button>
                <button className={settleDir==='receive' ? 'chip chipOn' : 'chip'} onClick={()=>setSettleDir('receive')}>Receive</button>
              </div>

              <div style={{marginTop:10}}>
                <div className="label">Other branch</div>
                <select className="select" value={settleOther} onChange={e=>setSettleOther(e.target.value)} style={{width:'100%'}}>
                  <option value="">—</option>
                  {branchOptions.map(b=> <option key={b.id} value={b.id}>{b.name_ar} / {b.name_en}</option>)}
                </select>
              </div>

              <div className="grid grid2" style={{marginTop:10}}>
                <div>
                  <div className="label">Amount</div>
                  <input className="input" value={settleAmount} onChange={e=>setSettleAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <div className="label">Note</div>
                  <input className="input" value={settleNote} onChange={e=>setSettleNote(e.target.value)} />
                </div>
              </div>

              <div className="row" style={{gap:10,marginTop:12}}>
                <button className="btn" onClick={()=>setSettleOpen(false)}>Close</button>
                <button className="btn btnPrimary" onClick={settle}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
