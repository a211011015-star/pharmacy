import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { useAuth } from '../state/auth'
import { BarcodeInput } from '../ui/BarcodeInput'

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

export function InventoryPage(){
  const toast = useToast()
  const { t } = useI18n()
  const { activeBranchId } = useAuth()

  const [batches,setBatches]=useState([])
  const [q,setQ]=useState('')
  const [openBatches,setOpenBatches]=useState(false)
  const [batchRows,setBatchRows]=useState([])
  const [selected,setSelected]=useState(null)

  useEffect(()=>{ load() },[activeBranchId])

  async function load(){
    if(!activeBranchId) return
    const r = await supabase
      .from('inventory_batches')
      .select('id,branch_id,product_id,qty_on_hand,purchase_price,expiry_date,received_at, product:product_id(id,trade_name_en,strength,dosage_form,default_selling_price,scientific_id, sci:scientific_id(scientific_en))')
      .eq('branch_id', activeBranchId)
      .order('expiry_date',{ascending:true})
      .limit(8000)

    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setBatches(r.data||[])
  }

  const summary = useMemo(()=>{
    const map = new Map()
    for(const b of batches){
      const p = b.product || {}
      const key = p.id || b.product_id
      if(!key) continue
      const cur = map.get(key) || {
        product_id: key,
        trade_name_en: p.trade_name_en || '',
        scientific_en: b.product?.sci?.scientific_en || '',
        dosage_form: p.dosage_form || '',
        strength: p.strength || '',
        selling_price: p.default_selling_price ?? 0,
        qty: 0,
        _costSum: 0,
        _qtySum: 0,
      }
      cur.qty += Number(b.qty_on_hand||0)
      cur._costSum += Number(b.purchase_price||0) * Number(b.qty_on_hand||0)
      cur._qtySum += Number(b.qty_on_hand||0)
      map.set(key, cur)
    }
    return Array.from(map.values()).map(x=>({
      ...x,
      avg_purchase: x._qtySum>0 ? (x._costSum/x._qtySum) : 0
    }))
  },[batches])

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return summary
    return summary.filter(x =>
      (x.trade_name_en+' '+x.scientific_en+' '+x.dosage_form+' '+x.strength).toLowerCase().includes(s)
    )
  },[summary,q])

  async function openBatchModal(item){
    setSelected(item)
    setOpenBatches(true)

    // query batches for this product
    const rb = await supabase
      .from('inventory_batches')
      .select('id,qty_on_hand,purchase_price,expiry_date,received_at')
      .eq('branch_id', activeBranchId)
      .eq('product_id', item.product_id)
      .order('expiry_date',{ascending:true})
      .limit(1000)

    if(rb.error){
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:rb.error.message,en:rb.error.message})
      setBatchRows([])
      return
    }

    // enrich each batch with purchase info (purchase_items -> purchases -> suppliers)
    const batchIds = (rb.data||[]).map(x=>x.id)
    if(!batchIds.length){
      setBatchRows([])
      return
    }

    const rpi = await supabase
      .from('purchase_items')
      .select('batch_id,unit_cost,qty,purchase:purchases(id,invoice_no,purchase_date,supplier_id, supplier:suppliers(id,name))')
      .in('batch_id', batchIds)
      .limit(2000)

    const map = new Map()
    for(const pi of (rpi.data||[])){
      map.set(pi.batch_id, pi)
    }

    const rows = (rb.data||[]).map(b=>{
      const pi = map.get(b.id)
      return {
        id: b.id,
        qty: b.qty_on_hand,
        purchase_price: b.purchase_price,
        expiry_date: b.expiry_date,
        received_at: b.received_at,
        invoice_no: pi?.purchase?.invoice_no || '',
        purchase_date: pi?.purchase?.purchase_date || '',
        supplier: pi?.purchase?.supplier?.name || ''
      }
    })
    setBatchRows(rows)
  }

  async function findByBarcode(code){
    if(!activeBranchId) return
    const r = await supabase.rpc('find_product_by_barcode', { p_branch_id: activeBranchId, p_barcode: code })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    const found = r.data?.[0]
    if(!found) return toast.show({titleAr:'غير موجود',titleEn:'Not found',ar:'لا يوجد هذا الباركود',en:'Barcode not found'})
    setQ(found.trade_name_en || '')
  }

  return (
    <div className="card">
      <div className="cardHeader row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:900}}>{t.inventory}</div>
        <div className="row">
          <BarcodeInput onScan={findByBarcode} placeholder={t.barcode} />
          <input className="input" style={{width:240}} value={q} onChange={(e)=>setQ(e.target.value)} placeholder={t.search}/>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="cardBody" style={{maxHeight:560,overflow:'auto'}}>
        <table className="table">
          <thead>
            <tr>
              <th>{t.trade} EN</th>
              <th>{t.scientific} EN</th>
              <th>{t.dosageForm}</th>
              <th>{t.strength}</th>
              <th>{t.qty}</th>
              <th>{t.purchasePrice}</th>
              <th>{t.sellingPrice}</th>
              <th style={{width:160}}>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.product_id}>
                <td><b>{r.trade_name_en}</b></td>
                <td className="hint">{r.scientific_en||''}</td>
                <td className="hint">{r.dosage_form||''}</td>
                <td className="hint">{r.strength||''}</td>
                <td><span className="badge">{Number(r.qty||0).toFixed(2)}</span></td>
                <td className="hint">{Number(r.avg_purchase||0).toFixed(3)}</td>
                <td className="hint">{Number(r.selling_price||0).toFixed(2)}</td>
                <td>
                  <button className="btn" onClick={()=>openBatchModal(r)} title={t.viewBatches}>{t.viewBatches}</button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="hint">No rows.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={openBatches} title={`${t.viewBatches}: ${selected?.trade_name_en||''}`} onClose={()=>setOpenBatches(false)}>
        <table className="table">
          <thead>
            <tr>
              <th>{t.qty}</th>
              <th>{t.purchasePrice}</th>
              <th>{t.exp}</th>
              <th>{t.date}</th>
              <th>{t.invoiceNo}</th>
              <th>{t.supplier}</th>
            </tr>
          </thead>
          <tbody>
            {batchRows.map(b=>(
              <tr key={b.id}>
                <td><span className="badge">{Number(b.qty||0).toFixed(2)}</span></td>
                <td className="hint">{Number(b.purchase_price||0).toFixed(3)}</td>
                <td className="hint">{b.expiry_date||''}</td>
                <td className="hint">{b.purchase_date||''}</td>
                <td className="hint">{b.invoice_no||''}</td>
                <td className="hint">{b.supplier||''}</td>
              </tr>
            ))}
            {!batchRows.length && <tr><td colSpan={6} className="hint">No batches.</td></tr>}
          </tbody>
        </table>
        <div className="hint" style={{marginTop:10}}>
          هنا يظهر اختلاف أسعار الشراء، المورد، وتاريخ قائمة الشراء لكل باتش. التراكيز تُعرض من بيانات المنتج.
        </div>
      </Modal>
    </div>
  )
}
