import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { useAuth } from '../state/auth'
import { BarcodeInput } from '../ui/BarcodeInput'

function money(n){ const x=Number(n||0); return x.toFixed(2) }

function Modal({open,title,children,onClose}){
  if(!open) return null
  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="modalHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{title}</div>
          <button className="btn btnDanger" onClick={onClose}>×</button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  )
}

export function POSPage(){
  const toast = useToast()
  const { t } = useI18n()
  const { activeBranchId, user } = useAuth()

  const bcRef = useRef(null)

  const [cart,setCart]=useState([])
  const [selectedProductId,setSelectedProductId]=useState(null)

  const [discountValue,setDiscountValue]=useState(0)
  const [discountType,setDiscountType]=useState('amount') // amount | percent
  const [paymentMethod,setPaymentMethod]=useState('cash')
  const [customerName,setCustomerName]=useState('')

  const [clinical,setClinical]=useState(null)
  const [qs,setQs]=useState([])

  const [holds,setHolds]=useState([])
  const [holdModal,setHoldModal]=useState(false)
  const [holdRef,setHoldRef]=useState('')

  const [lastInteractionHash,setLastInteractionHash]=useState('')
  const [interactionHits,setInteractionHits]=useState([])

  useEffect(()=>{ bcRef.current?.focus?.() },[])

  useEffect(()=>{(async()=>{
    if(!activeBranchId) return
    const { data } = await supabase
      .from('quick_sell_items')
      .select('id,label,product_id,sort_order,products:product_id(id,trade_name_en,trade_name_ar,strength,dosage_form,default_selling_price,scientific_id)')
      .eq('branch_id',activeBranchId)
      .order('sort_order',{ascending:true})
    setQs(data||[])
  })()},[activeBranchId])

// Load persisted holds
useEffect(()=>{(async()=>{
  if(!activeBranchId) return
  const r = await supabase
    .from('pos_holds')
    .select('list_ref,payload,created_at')
    .eq('branch_id', activeBranchId)
    .order('created_at',{ascending:false})
    .limit(30)
  if(!r.error){
    const hs = (r.data||[]).map(x=>({ ...x.payload, list_ref:x.list_ref })).filter(Boolean)
    setHolds(hs)
  }
})()},[activeBranchId])


  const subtotal = useMemo(()=> cart.reduce((a,x)=>a+Number(x.line_total||0),0),[cart])
  const discount = useMemo(()=>{
    if(discountType==='percent'){
      const p=Math.max(0,Math.min(100,Number(discountValue||0)))
      return subtotal*(p/100)
    }
    return Math.max(0,Number(discountValue||0))
  },[subtotal,discountValue,discountType])
  const grand = useMemo(()=> Math.max(0, subtotal - discount),[subtotal,discount])

  // Load clinical for selected
  useEffect(()=>{(async()=>{
    const pid = selectedProductId
    if(!pid) { setClinical(null); return }
    const r = await supabase.from('products').select('id,scientific_id').eq('id',pid).single()
    if(r.error){ setClinical(null); return }
    const sid = r.data?.scientific_id
    if(!sid){ setClinical(null); return }
    const s = await supabase.from('scientifics').select('*').eq('id',sid).single()
    if(s.error){ setClinical(null); return }
    setClinical(s.data)
  })()},[selectedProductId])

  // Interaction alert on cart change (scientific_interactions)
  useEffect(()=>{(async()=>{
    const ids = Array.from(new Set(cart.map(x=>x.scientific_id).filter(Boolean))).sort()
    if(ids.length<2){ setLastInteractionHash(''); return }

    const hash = ids.join('|')
    if(hash===lastInteractionHash) return

    const r = await supabase
      .from('scientific_interactions')
      .select('id,severity,comment, scientific_a_id, scientific_b_id, a:scientific_a_id(scientific_en), b:scientific_b_id(scientific_en)')
      .in('scientific_a_id', ids)
      .in('scientific_b_id', ids)
      .limit(50)

    if(r.error) return

    if((r.data||[]).length){
      const top = r.data[0]
      const msg = `${top.a?.scientific_en||''} × ${top.b?.scientific_en||''} (${top.severity})`
      toast.show({
        titleAr: t.warningInteraction,
        titleEn: 'Interaction',
        ar: msg + (top.comment ? ` — ${top.comment}` : ''),
        en: msg + (top.comment ? ` — ${top.comment}` : '')
      })
      setLastInteractionHash(hash)
    }else{
      setLastInteractionHash(hash)
    }
  })()},[cart])

  async function scanBarcode(code){
    if(!activeBranchId) return
    const r = await supabase.rpc('find_product_by_barcode', { p_branch_id: activeBranchId, p_barcode: code })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    const found = r.data?.[0]
    if(!found) return toast.show({titleAr:'غير موجود',titleEn:'Not found',ar:'لا يوجد هذا الباركود',en:'Barcode not found'})

    addToCart({
      product_id: found.product_id,
      name: found.trade_name_en || found.trade_name_ar || '',
      unit_price: Number(found.default_selling_price||0),
      scientific_id: found.scientific_id || null,
      scientific_en: found.scientific_en || ''
    })
  }

  function addToCart(p){
    setCart(prev=>{
      const idx = prev.findIndex(x=>x.product_id===p.product_id)
      const next=[...prev]
      if(idx>=0){
        const x=next[idx]
        const qty=Number(x.qty||0)+1
        next[idx]={...x, qty, line_total: qty*Number(x.unit_price||0)}
      }else{
        next.push({ product_id:p.product_id, name:p.name, scientific_id:p.scientific_id, scientific_en:p.scientific_en, unit_price:p.unit_price, qty:1, line_total:p.unit_price })
      }
      return next
    })
    setSelectedProductId(p.product_id)
  }

  function setQty(i, qty){
    qty = Math.max(0, Number(qty||0))
    setCart(prev=>{
      const next=[...prev]
      if(qty<=0){
        next.splice(i,1)
        return next
      }
      next[i]={...next[i], qty, line_total: qty*Number(next[i].unit_price||0)}
      return next
    })
  }

  async function hold(){
  if(!activeBranchId) return
  if(!cart.length) return
  const ref='H'+Math.random().toString(16).slice(2,8).toUpperCase()
  const payload={branch_id:activeBranchId,created_at:new Date().toISOString(),cart,discountValue,discountType,paymentMethod,customerName}
  const r = await supabase.from('pos_holds').insert({
    branch_id: activeBranchId,
    list_ref: ref,
    payload,
    created_by: user?.id || null,
  })
  if(r.error){
    toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    return
  }
  setHolds(prev=>[{...payload,list_ref:ref},...prev].slice(0,30))
  toast.show({titleAr:t.held,titleEn:'Held',ar:'تم تعليق: '+ref,en:'Held: '+ref})
}

  function resume(ref){
    const h=holds.find(x=>x.list_ref===ref); if(!h) return
    setCart(h.cart||[])
    setDiscountValue(h.discountValue||0)
    setDiscountType(h.discountType||'amount')
    setPaymentMethod(h.paymentMethod||'cash')
    setCustomerName(h.customerName||'')
    setHoldModal(false)
    toast.show({titleAr:t.resumed,titleEn:'Resumed',ar:'استئناف: '+ref,en:'Resumed: '+ref})
    // remove from DB
    supabase.from('pos_holds').delete().eq('branch_id', activeBranchId).eq('list_ref', ref)
    setHolds(prev=>prev.filter(x=>x.list_ref!==ref))
  }

  async function sell(){
    if(!activeBranchId) return
    if(!cart.length) return

    const list_ref = Math.random().toString(16).slice(2,10).toUpperCase()
    const payload = {
      branch_id: activeBranchId,
      list_ref,
      payment_method: paymentMethod,
      discount_value: Number(discountValue||0),
      discount_type: discountType,
      customer_name: customerName || null,
      items: cart.map(x=>({ product_id:x.product_id, qty:Number(x.qty||0) }))
    }

    const { data, error } = await supabase.rpc('sell_cart_fifo', { p_payload: payload })
    if(error) return toast.show({titleAr:'فشل البيع',titleEn:'Sell failed',ar:error.message,en:error.message})

    toast.show({titleAr:'تم البيع',titleEn:'Sold',ar:'تم: '+list_ref,en:'OK: '+list_ref})
    setCart([])
    setDiscountValue(0)
    setDiscountType('amount')
    setPaymentMethod('cash')
    setCustomerName('')
    setClinical(null)
    setSelectedProductId(null)
  }

  return (
    <div className="posWrap">
      <div className="posDock">
        <div style={{fontWeight:900,fontSize:18}}>{t.pos}</div>
        <div style={{fontWeight:900,fontSize:22}}>{money(grand)}</div>
      </div>

      {interactionHits.length>0 && (
        <div className="posAlertBanner">
          <div style={{fontWeight:900}}>{t.warningInteraction}</div>
          <div className="hint" style={{marginTop:4}}>
            {interactionHits.map((x,i)=>{
              const msg = `${x.a?.scientific_en||''} × ${x.b?.scientific_en||''} (${x.severity})` + (x.comment ? ` — ${x.comment}` : '')
              return <div key={x.id||i}>{msg}</div>
            })}
          </div>
        </div>
      )}

      <div className="posGrid">
        {/* Left: Cart (give breathing space) */}
        <div className="card" style={{minWidth:700}}>
          <div className="cardHeader row" style={{justifyContent:'space-between'}}>
            <div className="row" style={{gap:10}}>
              <BarcodeInput ref={bcRef} onScan={scanBarcode} />
              <button className="btn" onClick={hold}>Hold</button>
              <button className="btn" onClick={()=>setHoldModal(true)}>Resume</button>
            </div>
            <div className="hint">No print preview (direct sell)</div>
          </div>

          <div className="cardBody">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.trade}</th>
                  <th>{t.scientific}</th>
                  <th style={{width:90}}>{t.qty}</th>
                  <th style={{width:120}}>Unit</th>
                  <th style={{width:140}}>Total</th>
                  <th style={{width:70}}></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((x,i)=>(
                  <tr key={x.product_id} onClick={()=>setSelectedProductId(x.product_id)} style={{cursor:'pointer'}}>
                    <td><b>{x.name}</b></td>
                    <td className="hint">{x.scientific_en||''}</td>
                    <td>
                      <input className="input" value={x.qty} onChange={(e)=>setQty(i, e.target.value)} />
                    </td>
                    <td className="hint">{money(x.unit_price)}</td>
                    <td><b>{money(x.line_total)}</b></td>
                    <td><button className="btn btnDanger" onClick={()=>setQty(i,0)}>🗑</button></td>
                  </tr>
                ))}
                {!cart.length && <tr><td colSpan={6} className="hint">Scan barcode to add items.</td></tr>}
              </tbody>
            </table>

            {/* Payment row compact */}
            <div className="payRow">
              <div className="row" style={{gap:8,flexWrap:'wrap'}}>
                <div className="row" style={{gap:6}}>
                  <input className="input" style={{width:120}} value={discountValue} onChange={(e)=>setDiscountValue(e.target.value)} placeholder="Discount"/>
                  <div className="row" style={{gap:6}}>
                    <button className={"btn "+(discountType==='amount'?'btnPrimary':'')} onClick={()=>setDiscountType('amount')}>$</button>
                    <button className={"btn "+(discountType==='percent'?'btnPrimary':'')} onClick={()=>setDiscountType('percent')}>%</button>
                  </div>
                </div>

                <div className="row" style={{gap:6}}>
                  <button className={"btn "+(paymentMethod==='cash'?'btnPrimary':'')} onClick={()=>setPaymentMethod('cash')}>Cash</button>
                  <button className={"btn "+(paymentMethod==='card'?'btnPrimary':'')} onClick={()=>setPaymentMethod('card')}>Card</button>
                  <button className={"btn "+(paymentMethod==='credit'?'btnPrimary':'')} onClick={()=>setPaymentMethod('credit')}>Credit</button>
                </div>

                <input className="input" style={{width:220}} value={customerName} onChange={(e)=>setCustomerName(e.target.value)} placeholder="Customer (optional)"/>

                <button className="btn btnPrimary" style={{minWidth:150}} onClick={sell}>{t.pos} ✓</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick sell + clinical */}
        <div className="col" style={{gap:12,display:'flex',flexDirection:'column'}}>
          <div className="card">
            <div className="cardHeader">Quick Sell</div>
            <div className="cardBody">
              <div className="qsRow">
                {qs.map(x=>(
                  <button key={x.id} className="qsItem" onClick={()=>addToCart({
                    product_id:x.product_id,
                    name:x.products?.trade_name_en || x.label,
                    unit_price:Number(x.products?.default_selling_price||0),
                    scientific_id:x.products?.scientific_id||null,
                    scientific_en:''
                  })}>
                    <div style={{fontWeight:900}}>{x.label}</div>
                    <div className="hint">{money(x.products?.default_selling_price||0)}</div>
                  </button>
                ))}
              </div>
              {!qs.length && <div className="hint">No quick sell items.</div>}
            </div>
          </div>

          <div className="card">
            <div className="cardHeader">{t.scientifics}</div>
            <div className="cardBody">
              {clinical ? (
                <div className="col" style={{gap:8}}>
                  <div><b>{clinical.scientific_en}</b></div>
                  <div className="hint"><b>{t.info}:</b> {clinical.info||'—'}</div>
                  <div className="hint"><b>{t.pregnancy}:</b> {clinical.pregnancy||'—'}</div>
                  <div className="hint"><b>{t.lactation}:</b> {clinical.lactation||'—'}</div>
                  <div className="hint"><b>{t.kidney}:</b> {clinical.kidney||'—'}</div>
                  <div className="hint"><b>{t.liver}:</b> {clinical.liver||'—'}</div>
                </div>
              ) : (
                <div className="hint">Select an item to show clinical summary.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={holdModal} title="Resume Hold" onClose={()=>setHoldModal(false)}>
        <div className="row" style={{gap:8}}>
          <input className="input" value={holdRef} onChange={e=>setHoldRef(e.target.value)} placeholder="Hold Ref…"/>
          <button className="btn btnPrimary" onClick={()=>resume(holdRef)}>Resume</button>
        </div>
        <div className="hint" style={{marginTop:10}}>آخر 30 تعليق محفوظ في قاعدة البيانات (حسب الفرع).</div>
        <table className="table" style={{marginTop:10}}>
          <thead><tr><th>Ref</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {holds.map(h=>(
              <tr key={h.list_ref}>
                <td><b>{h.list_ref}</b></td>
                <td className="hint">{h.created_at}</td>
                <td><button className="btn" onClick={()=>resume(h.list_ref)}>Resume</button></td>
              </tr>
            ))}
            {!holds.length && <tr><td colSpan={3} className="hint">No holds.</td></tr>}
          </tbody>
        </table>
      </Modal>
    </div>
  )
}
