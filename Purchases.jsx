import React, { useEffect, useMemo, useState } from 'react'
import { supabase, SUPABASE_CONFIG_OK } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { useAuth } from '../state/auth'
import { BarcodeInput } from '../ui/BarcodeInput'
import { ScientificMultiSelect } from '../ui/ScientificMultiSelect'

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

const DOSAGE_FORMS = [
  {code:'TAB', en:'Tablet'},
  {code:'CAP', en:'Capsule'},
  {code:'SYR', en:'Syrup'},
  {code:'SUS', en:'Suspension'},
  {code:'DROP', en:'Drops'},
  {code:'INJ', en:'Injection'},
  {code:'CRM', en:'Cream'},
  {code:'OINT', en:'Ointment'},
  {code:'GEL', en:'Gel'},
  {code:'SPR', en:'Spray'},
  {code:'SUPP', en:'Suppository'},
]

function isLiquid(code){
  return ['SYR','SUS','DROP'].includes(String(code||'').toUpperCase())
}

const STRENGTH_UNITS = ['mg','g','mcg','IU','%']
const PER_UNITS = ['mL','L']

function buildStrength(dosage_form, strength_value, strength_unit, per_value, per_unit){
  const v = String(strength_value||'').trim()
  if(!v) return null
  const u = String(strength_unit||'').trim() || 'mg'
  if(isLiquid(dosage_form)){
    const pv = String(per_value||'').trim() || '5'
    const pu = String(per_unit||'').trim() || 'mL'
    return `${v} ${u}/${pv} ${pu}`
  }
  return `${v} ${u}`
}

function emptyLine(){
  return {
    barcode:'',
    product_id:'',
    trade_name_en:'',
    scientific_id:'',
    scientific_en:'',
    dosage_form:'TAB',
    strength_main:'',
    strength_per:'',
    unit_cost:'',
    qty:'1',
    selling_price:'',
    expiry_date:''
  }
}

function asNum(v){
  const n = Number(String(v||'').trim())
  return Number.isFinite(n) ? n : NaN
}

export function PurchasesPage(){
  const toast = useToast()
  const { t } = useI18n()
  const { activeBranchId, user } = useAuth()

  const [suppliers,setSuppliers]=useState([])
  const [products,setProducts]=useState([])
  const [scientifics,setScientifics]=useState([])

  const [showNewSupplier,setShowNewSupplier]=useState(false)
  const [supplierDraft,setSupplierDraft]=useState({ name:'', phone:'', notes:'' })

  const [header,setHeader]=useState({ supplier_id:'', invoice_no:'', purchase_date: new Date().toISOString().slice(0,10) })
  const [lines,setLines]=useState([])

  const [purchaseHistory,setPurchaseHistory]=useState([])
  const [histFilters,setHistFilters]=useState({ q:'', from:'', to:'' })
  const [viewPurchase,setViewPurchase]=useState(null)
  const [editPurchase,setEditPurchase]=useState(null)

  // item modal
  const [itemOpen,setItemOpen]=useState(false)
  const [editingIdx,setEditingIdx]=useState(-1)
  const [lineForm,setLineForm]=useState(emptyLine())

  // embedded create forms (inside item modal)
  const [showNewProduct,setShowNewProduct]=useState(false)
  const [showNewScientific,setShowNewScientific]=useState(false)
  const [productDraft,setProductDraft]=useState({
    trade_name_en:'',
    barcode:'',
    dosage_form:'TAB',
    scientific_ids:[],
    strength_value:'',
    strength_unit:'mg',
    per_value:'5',
    per_unit:'mL',
    default_selling_price:''
  })
  const [scientificDraft,setScientificDraft]=useState({ scientific_en:'', info:'', liver:'', kidney:'', pregnancy:'', lactation:'' })

  useEffect(()=>{ loadLookups(); loadHistory() },[activeBranchId])
  useEffect(()=>{ loadHistory() },[histFilters.from,histFilters.to,activeBranchId])


async function loadHistory(){
  if(!activeBranchId) return
  let q = supabase.from('purchases').select('id,invoice_no,purchase_date,total_cost,created_at,supplier_id,suppliers(name)').eq('branch_id',activeBranchId).order('created_at',{ascending:false}).limit(200)
  if(histFilters.from) q = q.gte('purchase_date', histFilters.from)
  if(histFilters.to) q = q.lte('purchase_date', histFilters.to)
  const { data, error } = await q
  if(!error) setPurchaseHistory(data||[])
}

  async function loadLookups(){
    if(!SUPABASE_CONFIG_OK || !activeBranchId) return
    try{
      const [s, p, sc] = await Promise.all([
        supabase.from('suppliers').select('id,name').eq('branch_id', activeBranchId).order('name',{ascending:true}).limit(2000),
        supabase.from('products').select('id,trade_name_en,strength,dosage_form,default_selling_price,scientific_id').eq('branch_id', activeBranchId).order('trade_name_en',{ascending:true}).limit(10000),
        supabase.from('scientifics').select('id,scientific_en').order('scientific_en',{ascending:true}).limit(5000),
      ])
      if(s.error) throw s.error
      if(p.error) throw p.error
      if(sc.error) throw sc.error
      setSuppliers(s.data||[])
      setProducts(p.data||[])
      setScientifics(sc.data||[])
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  function openAddItem(){
    setEditingIdx(-1)
    setLineForm(emptyLine())
    setShowNewProduct(false)
    setShowNewScientific(false)
    setItemOpen(true)
  }

  function openEditItem(idx){
    setEditingIdx(idx)
    setLineForm({ ...lines[idx] })
    setShowNewProduct(false)
    setShowNewScientific(false)
    setItemOpen(true)
  }

  function delItem(idx){
    setLines(lines.filter((_,i)=>i!==idx))
  }

  function strengthLabel(l){
    if(isLiquid(l.dosage_form)){
      const a=(l.strength_main||'').trim()
      const b=(l.strength_per||'').trim()
      return [a,b].filter(Boolean).join(' / ')
    }
    return (l.strength_main||'').trim()
  }

  async function scanBarcodeAndFill(code){
    const barcode = String(code||'').trim()
    if(!barcode || !activeBranchId) return
    setLineForm(prev=>({ ...prev, barcode }))

    if(!SUPABASE_CONFIG_OK) return

    try{
      // RPC: find_product_by_barcode
      const r = await supabase.rpc('find_product_by_barcode', { p_branch_id: activeBranchId, p_barcode: barcode })
      if(r.error) throw r.error

      const row = (r.data && r.data[0]) ? r.data[0] : null
      if(!row){
        toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'لم يتم العثور على المنتج. يمكنك إضافته من داخل المودال.',en:'Product not found. You can add it in the modal.'})
        return
      }

      setLineForm(prev=>({
        ...prev,
        product_id: row.product_id,
        trade_name_en: row.trade_name_en || '',
        scientific_id: row.scientific_id || '',
        scientific_en: row.scientific_en || '',
        dosage_form: row.dosage_form || 'TAB',
        strength_main: row.strength || '',
        strength_per: '',
        selling_price: String(row.default_selling_price ?? ''),
      }))
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({
        titleAr:'خطأ',
        titleEn:'Error',
        ar: msg.includes('Failed to fetch')
          ? 'فشل الاتصال بـ Supabase. صحح بيانات web/.env ثم أعد تشغيل npm run dev.'
          : msg,
        en: msg.includes('Failed to fetch')
          ? 'Failed to reach Supabase. Fix web/.env then restart npm run dev.'
          : msg
      })
    }
  }

  function selectProduct(id){
    const p = products.find(x=>x.id===id)
    if(!p){
      setLineForm(prev=>({ ...prev, product_id:'', trade_name_en:'', strength_main:'', dosage_form:'TAB', selling_price:'', scientific_id:'', scientific_en:'' }))
      return
    }
    const sci = scientifics.find(s=>s.id===p.scientific_id)
    setLineForm(prev=>({
      ...prev,
      product_id: p.id,
      trade_name_en: p.trade_name_en || '',
      dosage_form: p.dosage_form || 'TAB',
      strength_main: p.strength || '',
      strength_per: '',
      selling_price: String(p.default_selling_price ?? ''),
      scientific_id: p.scientific_id || '',
      scientific_en: sci?.scientific_en || '',
    }))
  }

  function selectScientific(id){
    const s = scientifics.find(x=>x.id===id)
    setLineForm(prev=>({ ...prev, scientific_id: id, scientific_en: s?.scientific_en || '' }))
  }

  function validateLine(l){
    if(!l.product_id) return {ok:false, msgAr:'اختر/أضف منتج', msgEn:'Select/add product'}
    const qty = asNum(l.qty)
    const cost = asNum(l.unit_cost)
    if(!Number.isFinite(qty) || qty<=0) return {ok:false, msgAr:'كمية غير صحيحة', msgEn:'Invalid qty'}
    if(!Number.isFinite(cost) || cost<0) return {ok:false, msgAr:'تكلفة غير صحيحة', msgEn:'Invalid cost'}
    return {ok:true}
  }

  function saveLineFromModal(){
    const chk = validateLine(lineForm)
    if(!chk.ok){
      toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:chk.msgAr,en:chk.msgEn})
      return
    }
    const next = { ...lineForm }
    if(editingIdx>=0){
      const copy=[...lines]
      copy[editingIdx]=next
      setLines(copy)
    }else{
      setLines([...lines, next])
    }
    setItemOpen(false)
  }


async function createSupplierInline(){
  if(!SUPABASE_CONFIG_OK || !activeBranchId) return
  const name = String(supplierDraft.name||'').trim()
  if(!name) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب اسم المورد',en:'Enter supplier name'})
  const r = await supabase.from('suppliers').insert({
    branch_id: activeBranchId,
    name,
    phone: supplierDraft.phone || null,
    notes: supplierDraft.notes || null
  }).select('id,name').single()
  if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
  toast.show({titleAr:'تم',titleEn:'OK',ar:'تم إنشاء مورد',en:'Supplier created'})
  setSuppliers(prev=>[{id:r.data.id,name:r.data.name},...prev])
  setHeader(prev=>({...prev, supplier_id: r.data.id}))
  setSupplierDraft({ name:'', phone:'', notes:'' })
  setShowNewSupplier(false)
}

  async function createScientificInline(){
    if(!SUPABASE_CONFIG_OK) return
    const name = String(scientificDraft.scientific_en||'').trim()
    if(!name) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب الاسم العلمي EN',en:'Enter scientific EN'})
    try{
      const r = await supabase.from('scientifics').insert({
        scientific_en: name,
        info: scientificDraft.info || null,
        liver: scientificDraft.liver || null,
        kidney: scientificDraft.kidney || null,
        pregnancy: scientificDraft.pregnancy || null,
        lactation: scientificDraft.lactation || null,
      }).select('id,scientific_en').single()
      if(r.error) throw r.error

      toast.show({titleAr:'تم',titleEn:'OK',ar:'تم إنشاء الاسم العلمي',en:'Scientific created'})
      await loadLookups()
      selectScientific(r.data.id)
      // also select for new product modal
      if(showNewProduct){
        setProductDraft(prev=>({ ...prev, scientific_ids: Array.from(new Set([...(prev.scientific_ids||[]), r.data.id])) }))
      }
      setScientificDraft({ scientific_en:'', info:'', liver:'', kidney:'', pregnancy:'', lactation:'' })
      setShowNewScientific(false)
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  
async function createProductInline(){
    if(!SUPABASE_CONFIG_OK || !activeBranchId) return

    const trade = String(productDraft.trade_name_en||'').trim()
    if(!trade) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب الاسم التجاري EN',en:'Enter trade EN'})

    const barcode = String(productDraft.barcode||'').trim()
    if(!barcode) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب الباركود',en:'Enter barcode'})

    const scientific_ids = (productDraft.scientific_ids||[]).filter(Boolean)
    const primary_scientific = scientific_ids[0] || null

    const strength = buildStrength(
      productDraft.dosage_form,
      productDraft.strength_value,
      productDraft.strength_unit,
      productDraft.per_value,
      productDraft.per_unit
    )

    const selling = asNum(productDraft.default_selling_price)
    const selling_price = Number.isFinite(selling) ? selling : 0

    try{
      const pr = await supabase.from('products').insert({
        branch_id: activeBranchId,
        trade_name_en: trade,
        trade_name_ar: trade,
        scientific_id: primary_scientific,
        strength: strength || null,
        dosage_form: productDraft.dosage_form || 'TAB',
        default_selling_price: selling_price,
        is_active: true,
      }).select('id,trade_name_en,strength,dosage_form,default_selling_price,scientific_id').single()
      if(pr.error) throw pr.error

      const br = await supabase.from('product_barcodes').insert({
        branch_id: activeBranchId,
        product_id: pr.data.id,
        barcode
      })
      if(br.error) throw br.error

      // multi scientific mapping (optional table)
      if(scientific_ids.length){
        const ins = await supabase.from('product_scientifics').insert(scientific_ids.map(sid=>({
          branch_id: activeBranchId,
          product_id: pr.data.id,
          scientific_id: sid
        })))
        // if table missing, ignore silently
        if(ins.error && !String(ins.error.message||'').toLowerCase().includes('relation') ){
          throw ins.error
        }
      }

      toast.show({titleAr:'تم',titleEn:'OK',ar:'تم إنشاء المنتج',en:'Product created'})
      await loadLookups()

      // set line form product
      setLineForm(prev=>({
        ...prev,
        product_id: pr.data.id,
        trade_name_en: pr.data.trade_name_en,
        dosage_form: pr.data.dosage_form || prev.dosage_form,
        strength_main: pr.data.strength || '',
        strength_per: '',
        selling_price: String(pr.data.default_selling_price ?? ''),
        scientific_id: pr.data.scientific_id || '',
        scientific_en: (scientifics.find(s=>s.id===pr.data.scientific_id)?.scientific_en) || prev.scientific_en || ''
      }))

      setProductDraft({
        trade_name_en:'',
        barcode:'',
        dosage_form:'TAB',
        scientific_ids:[],
        strength_value:'',
        strength_unit:'mg',
        per_value:'5',
        per_unit:'mL',
        default_selling_price:''
      })
      setShowNewProduct(false)
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

const totalCost = useMemo(()=>{
    return lines.reduce((sum,l)=>{
      const qty=asNum(l.qty)
      const cost=asNum(l.unit_cost)
      if(!Number.isFinite(qty) || !Number.isFinite(cost)) return sum
      return sum + qty*cost
    },0)
  },[lines])

  async function confirmReceive(){
    if(!SUPABASE_CONFIG_OK || !activeBranchId) return
    if(!lines.length){
      return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'أضف بند واحد على الأقل',en:'Add at least one item'})
    }

    // update selling price (optional) before receiving
    try{
      const updates = new Map()
      for(const l of lines){
        const sp = asNum(l.selling_price)
        if(Number.isFinite(sp) && sp>0 && l.product_id){
          updates.set(l.product_id, sp)
        }
      }
      for(const [pid,sp] of updates.entries()){
        const u = await supabase.from('products').update({ default_selling_price: sp }).eq('id', pid).eq('branch_id', activeBranchId)
        if(u.error) throw u.error
      }

      const payload = {
        branch_id: activeBranchId,
        supplier_id: header.supplier_id || null,
        invoice_no: header.invoice_no || null,
        purchase_date: header.purchase_date || null,
        items: lines.map(l=>({
          product_id: l.product_id,
          qty: String(l.qty),
          unit_cost: String(l.unit_cost),
          expiry_date: l.expiry_date || null
        }))
      }

      const r = await supabase.rpc('receive_purchase', { p_payload: payload })
      if(r.error) throw r.error

      toast.show({titleAr:'تم',titleEn:'OK',ar:'تم استلام المشتريات',en:'Purchase received'})
      setLines([])
      setHeader(prev=>({ ...prev, invoice_no:'' }))
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  return (
    <div className="grid" style={{gap:12}}>
      <div className="card">
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{t.purchases}</div>
          <div className="row">
            <button className="btn btnPrimary" onClick={openAddItem}>{t.addItem}</button>
            <button className="btn" onClick={confirmReceive}>{t.confirm}</button>
          </div>
        </div>

        {!SUPABASE_CONFIG_OK && (
          <div className="cardBody">
            <div className="hint">
              Supabase غير مضبوط. افتح الملف: <b>web/.env</b> وضع بيانات مشروعك ثم أعد تشغيل: <b>npm run dev</b>
            </div>
          </div>
        )}

        {SUPABASE_CONFIG_OK && (
          <div className="cardBody">
            <div className="grid grid2">
              <div>
                <div className="label">{t.supplier}</div>
                <select className="select" value={header.supplier_id} onChange={e=>setHeader({...header,supplier_id:e.target.value})} style={{width:'100%'}}>
                  <option value="">--</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div className="label">{t.invoiceNo}</div>
                <input className="input" value={header.invoice_no} onChange={e=>setHeader({...header,invoice_no:e.target.value})} placeholder="INV-001" />
              </div>
              <div>
                <div className="label">{t.date}</div>
                <input type="date" className="input" value={header.purchase_date} onChange={e=>setHeader({...header,purchase_date:e.target.value})} />
              </div>
              <div>
                <div className="label">{t.total}</div>
                <div className="input" style={{display:'flex',alignItems:'center',fontWeight:900}}>{totalCost.toFixed(2)}</div>
              </div>
            </div>

            <div style={{marginTop:12,overflow:'auto'}}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{width:200}}>{t.barcode}</th>
                    <th style={{minWidth:220}}>{t.trade}</th>
                    <th style={{minWidth:200}}>{t.scientific}</th>
                    <th style={{width:130}}>{t.dosageForm}</th>
                    <th style={{width:220}}>{t.strength}</th>
                    <th style={{width:110}}>{t.cost}</th>
                    <th style={{width:90}}>{t.qty}</th>
                    <th style={{width:120}}>{t.sellingPrice}</th>
                    <th style={{width:150}}>{t.exp}</th>
                    <th style={{width:110}}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l,idx)=>(
                    <tr key={idx}>
                      <td className="hint">{l.barcode || '—'}</td>
                      <td><b>{l.trade_name_en || '—'}</b></td>
                      <td className="hint">{l.scientific_en || '—'}</td>
                      <td className="hint">{l.dosage_form}</td>
                      <td className="hint">{strengthLabel(l) || '—'}</td>
                      <td className="hint">{l.unit_cost}</td>
                      <td className="hint">{l.qty}</td>
                      <td className="hint">{l.selling_price || '—'}</td>
                      <td className="hint">{l.expiry_date || '—'}</td>
                      <td>
                        <div className="row" style={{gap:8,justifyContent:'flex-end'}}>
                          <button className="btn" onClick={()=>openEditItem(idx)} title={t.editItem}>✎</button>
                          <button className="btn btnDanger" onClick={()=>delItem(idx)} title={t.delete}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!lines.length && <tr><td colSpan={10} className="hint">No items yet.</td></tr>}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>

      
{/* Purchase History */}
<div className="card">
  <div className="cardHeader row" style={{justifyContent:'space-between'}}>
    <div style={{fontWeight:900}}>Purchase history</div>
    <div className="row" style={{gap:10}}>
      <input className="input" style={{width:130}} type="date" value={histFilters.from} onChange={e=>setHistFilters({...histFilters,from:e.target.value})}/>
      <input className="input" style={{width:130}} type="date" value={histFilters.to} onChange={e=>setHistFilters({...histFilters,to:e.target.value})}/>
      <button className="btn" onClick={loadHistory}>Refresh</button>
    </div>
  </div>
  <div className="cardBody" style={{maxHeight:380,overflow:'auto'}}>
    <table className="table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Supplier</th>
          <th>Date</th>
          <th>Total</th>
          <th style={{width:170}}>{t.actions}</th>
        </tr>
      </thead>
      <tbody>
        {purchaseHistory.map(p=>(
          <tr key={p.id}>
            <td><b>{p.invoice_no||'—'}</b></td>
            <td className="hint">{p.suppliers?.name || '—'}</td>
            <td className="hint">{p.purchase_date}</td>
            <td className="hint">{Number(p.total_cost||0).toFixed(2)}</td>
            <td>
              <div className="row" style={{gap:8,justifyContent:'flex-end'}}>
                <button className="btn" onClick={()=>setViewPurchase(p)}>👁</button>
                <button className="btn" onClick={()=>setEditPurchase({id:p.id, supplier_id:p.supplier_id||'', invoice_no:p.invoice_no||'', purchase_date:p.purchase_date})}>✎</button>
                <button className="btn btnDanger" onClick={()=>deletePurchase(p.id)}>🗑</button>
              </div>
            </td>
          </tr>
        ))}
        {!purchaseHistory.length && <tr><td colSpan={5} className="hint">No purchases.</td></tr>}
      </tbody>
    </table>
  </div>
</div>

<Modal open={itemOpen} title={editingIdx>=0 ? t.editItem : t.addItem} onClose={()=>setItemOpen(false)}>
        <div className="grid" style={{gap:12}}>
          <div className="grid grid2">
            <div>
              <div className="label">{t.barcode}</div>
              <BarcodeInput
                value={lineForm.barcode}
                onChange={(v)=>setLineForm(prev=>({ ...prev, barcode:v }))}
                onEnter={(code)=>scanBarcodeAndFill(code)}
                placeholder="Scan / Enter barcode"
              />
              <div className="hint" style={{marginTop:6}}>
                Enter/Scan ثم Enter للبحث.
              </div>
            </div>

            <div>
              <div className="label">{t.trade}</div>
              <div className="row" style={{gap:8}}>
                <select className="select" value={lineForm.product_id} onChange={e=>selectProduct(e.target.value)} style={{width:'100%'}}>
                  <option value="">--</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.trade_name_en}</option>)}
                </select>
                <button className="btn btnPrimary" onClick={()=>setShowNewProduct(v=>!v)} title="New product">＋</button>
              </div>
            </div>

            <div>
              <div className="label">{t.scientific}</div>
              <div className="row" style={{gap:8}}>
                <select className="select" value={lineForm.scientific_id||''} onChange={e=>selectScientific(e.target.value)} style={{width:'100%'}}>
                  <option value="">--</option>
                  {scientifics.map(s=><option key={s.id} value={s.id}>{s.scientific_en}</option>)}
                </select>
                <button className="btn btnPrimary" onClick={()=>setShowNewScientific(v=>!v)} title="New scientific">＋</button>
              </div>
              <div className="hint" style={{marginTop:6}}>
                {lineForm.scientific_en || '—'}
              </div>
            </div>

            <div>
              <div className="label">{t.dosageForm}</div>
              <select className="select" value={lineForm.dosage_form} onChange={e=>setLineForm(prev=>({ ...prev, dosage_form:e.target.value }))} style={{width:'100%'}}>
                {DOSAGE_FORMS.map(d=><option key={d.code} value={d.code}>{d.en}</option>)}
              </select>
            </div>

            <div>
              <div className="label">{t.strength}</div>
              {isLiquid(lineForm.dosage_form) ? (
                <div className="row" style={{gap:8}}>
                  <input className="input" value={lineForm.strength_main} onChange={e=>setLineForm(prev=>({ ...prev, strength_main:e.target.value }))} placeholder="Strength (e.g. 250 mg)" />
                  <input className="input" value={lineForm.strength_per} onChange={e=>setLineForm(prev=>({ ...prev, strength_per:e.target.value }))} placeholder="Per (e.g. per 5 mL)" />
                </div>
              ) : (
                <input className="input" value={lineForm.strength_main} onChange={e=>setLineForm(prev=>({ ...prev, strength_main:e.target.value }))} placeholder="Strength (optional)" />
              )}
            </div>

            <div>
              <div className="label">{t.cost}</div>
              <input className="input" value={lineForm.unit_cost} onChange={e=>setLineForm(prev=>({ ...prev, unit_cost:e.target.value }))} placeholder="0.00" />
            </div>

            <div>
              <div className="label">{t.qty}</div>
              <input className="input" value={lineForm.qty} onChange={e=>setLineForm(prev=>({ ...prev, qty:e.target.value }))} placeholder="1" />
            </div>

            <div>
              <div className="label">{t.sellingPrice}</div>
              <input className="input" value={lineForm.selling_price} onChange={e=>setLineForm(prev=>({ ...prev, selling_price:e.target.value }))} placeholder="0.00" />
              <div className="hint" style={{marginTop:6}}>
                سيتم تحديث سعر البيع الافتراضي للمنتج عند التأكيد (اختياري).
              </div>
            </div>

            <div>
              <div className="label">{t.exp}</div>
              <input type="date" className="input" value={lineForm.expiry_date} onChange={e=>setLineForm(prev=>({ ...prev, expiry_date:e.target.value }))} />
            </div>
          </div>

          {/* Inline create scientific */}
          
{showNewSupplier && (
            <div className="card" style={{marginTop:8}}>
              <div className="cardHeader row" style={{justifyContent:'space-between'}}>
                <div style={{fontWeight:900}}>{t.addSupplier}</div>
                <button className="btn btnDanger" onClick={()=>setShowNewSupplier(false)}>{t.cancel}</button>
              </div>
              <div className="cardBody">
                <div className="grid grid2">
                  <div>
                    <div className="label">{t.supplier}</div>
                    <input className="input" value={supplierDraft.name} onChange={e=>setSupplierDraft({...supplierDraft,name:e.target.value})}/>
                  </div>
                  <div>
                    <div className="label">Phone</div>
                    <input className="input" value={supplierDraft.phone} onChange={e=>setSupplierDraft({...supplierDraft,phone:e.target.value})}/>
                  </div>
                </div>
                <div style={{marginTop:10}}>
                  <div className="label">Notes</div>
                  <textarea className="textarea" value={supplierDraft.notes} onChange={e=>setSupplierDraft({...supplierDraft,notes:e.target.value})}/>
                </div>
                <div className="row" style={{gap:10,marginTop:12}}>
                  <button className="btn btnPrimary" onClick={createSupplierInline}>{t.confirm}</button>
                </div>
              </div>
            </div>
          )}

{showNewScientific && (
            <div className="card" style={{marginTop:8}}>
              <div className="cardHeader row" style={{justifyContent:'space-between'}}>
                <div style={{fontWeight:900}}>New Scientific (EN)</div>
                <button className="btn" onClick={()=>setShowNewScientific(false)}>{t.cancel}</button>
              </div>
              <div className="cardBody">
                <div className="label">Scientific EN</div>
                <input className="input" value={scientificDraft.scientific_en} onChange={e=>setScientificDraft({...scientificDraft,scientific_en:e.target.value})} />
                <div className="label" style={{marginTop:10}}>{t.info}</div>
                <textarea className="textarea" value={scientificDraft.info} onChange={e=>setScientificDraft({...scientificDraft,info:e.target.value})} style={{minHeight:90}} />
                <div className="grid grid2" style={{marginTop:10}}>
                  <div>
                    <div className="label">{t.liver}</div>
                    <textarea className="textarea" value={scientificDraft.liver} onChange={e=>setScientificDraft({...scientificDraft,liver:e.target.value})} style={{minHeight:80}} />
                  </div>
                  <div>
                    <div className="label">{t.kidney}</div>
                    <textarea className="textarea" value={scientificDraft.kidney} onChange={e=>setScientificDraft({...scientificDraft,kidney:e.target.value})} style={{minHeight:80}} />
                  </div>
                </div>
                <div className="grid grid2" style={{marginTop:10}}>
                  <div>
                    <div className="label">{t.pregnancy}</div>
                    <textarea className="textarea" value={scientificDraft.pregnancy} onChange={e=>setScientificDraft({...scientificDraft,pregnancy:e.target.value})} style={{minHeight:80}} />
                  </div>
                  <div>
                    <div className="label">{t.lactation}</div>
                    <textarea className="textarea" value={scientificDraft.lactation} onChange={e=>setScientificDraft({...scientificDraft,lactation:e.target.value})} style={{minHeight:80}} />
                  </div>
                </div>

                <div className="row" style={{gap:10,marginTop:12}}>
                  <button className="btn btnPrimary" onClick={createScientificInline}>{t.confirm}</button>
                </div>
              </div>
            </div>
          )}

          {/* Inline create product */}
          
{showNewProduct && (
            <div className="card" style={{marginTop:8}}>
              <div className="cardHeader row" style={{justifyContent:'space-between'}}>
                <div style={{fontWeight:900}}>New Product (EN)</div>
                <button className="btn btnDanger" onClick={()=>setShowNewProduct(false)}>{t.cancel}</button>
              </div>
              <div className="cardBody">

                <div className="grid grid2">
                  <div>
                    <div className="label">{t.trade} EN</div>
                    <input className="input" value={productDraft.trade_name_en} onChange={e=>setProductDraft({...productDraft,trade_name_en:e.target.value})} />
                  </div>
                  <div>
                    <div className="label">{t.barcode}</div>
                    <input className="input" value={productDraft.barcode} onChange={e=>setProductDraft({...productDraft,barcode:e.target.value})} placeholder="Scan / type" />
                  </div>
                </div>

                <div style={{marginTop:10}}>
                  <div className="label">{t.scientific} (Multi)</div>
                  <ScientificMultiSelect
                    options={scientifics}
                    value={productDraft.scientific_ids}
                    onChange={(ids)=>setProductDraft({...productDraft, scientific_ids: ids})}
                    placeholder="Type to search scientific..."
                  />
                  <div className="hint" style={{marginTop:6}}>
                    يمكنك اختيار أكثر من اسم علمي. سيتم حفظ الأول كـ “Primary” للعرض السريع.
                  </div>
                </div>

                <div className="grid grid2" style={{marginTop:10}}>
                  <div>
                    <div className="label">{t.dosageForm}</div>
                    <select className="select" value={productDraft.dosage_form} onChange={e=>setProductDraft({...productDraft,dosage_form:e.target.value})} style={{width:'100%'}}>
                      {DOSAGE_FORMS.map(d=><option key={d.code} value={d.code}>{d.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">{t.sellingPrice}</div>
                    <input className="input" value={productDraft.default_selling_price} onChange={e=>setProductDraft({...productDraft,default_selling_price:e.target.value})} />
                  </div>
                </div>

                <div className="grid grid2" style={{marginTop:10}}>
                  <div>
                    <div className="label">{t.strength}</div>
                    <div className="row" style={{gap:10}}>
                      <input className="input" value={productDraft.strength_value} onChange={e=>setProductDraft({...productDraft,strength_value:e.target.value})} placeholder="e.g. 500" />
                      <select className="select" value={productDraft.strength_unit} onChange={e=>setProductDraft({...productDraft,strength_unit:e.target.value})} style={{width:140}}>
                        {STRENGTH_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  {isLiquid(productDraft.dosage_form) ? (
                    <div>
                      <div className="label">Per (Liquids)</div>
                      <div className="row" style={{gap:10}}>
                        <input className="input" value={productDraft.per_value} onChange={e=>setProductDraft({...productDraft,per_value:e.target.value})} placeholder="e.g. 5" />
                        <select className="select" value={productDraft.per_unit} onChange={e=>setProductDraft({...productDraft,per_unit:e.target.value})} style={{width:140}}>
                          {PER_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="label">—</div>
                      <div className="hint" style={{paddingTop:10}}>Liquids use format like “250 mg/5 mL”.</div>
                    </div>
                  )}
                </div>

                <div className="row" style={{gap:10,marginTop:12}}>
                  <button className="btn btnPrimary" onClick={createProductInline}>{t.confirm}</button>
                </div>

              </div>
            </div>
          )}

          <div className="row" style={{gap:10,justifyContent:'flex-end', marginTop:6}}>
            <button className="btn" onClick={()=>setItemOpen(false)}>{t.cancel}</button>
            <button className="btn btnPrimary" onClick={saveLineFromModal}>{t.save}</button>
          </div>
        </div>
      </Modal>


<Modal open={!!viewPurchase} title="Purchase details" onClose={()=>setViewPurchase(null)}>
  <PurchaseDetails purchase={viewPurchase} />
</Modal>

<Modal open={!!editPurchase} title="Edit purchase header" onClose={()=>setEditPurchase(null)}>
  {editPurchase && (
    <div className="col" style={{gap:10}}>
      <div>
        <div className="label">Supplier</div>
        <select className="select" value={editPurchase.supplier_id} onChange={e=>setEditPurchase({...editPurchase,supplier_id:e.target.value})} style={{width:'100%'}}>
          <option value="">—</option>
          {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <div className="label">Invoice</div>
        <input className="input" value={editPurchase.invoice_no} onChange={e=>setEditPurchase({...editPurchase,invoice_no:e.target.value})}/>
      </div>
      <div>
        <div className="label">Date</div>
        <input className="input" type="date" value={editPurchase.purchase_date} onChange={e=>setEditPurchase({...editPurchase,purchase_date:e.target.value})}/>
      </div>
      <div className="row" style={{gap:10,justifyContent:'flex-end'}}>
        <button className="btn" onClick={()=>setEditPurchase(null)}>{t.cancel}</button>
        <button className="btn btnPrimary" onClick={updatePurchaseHeader}>{t.save}</button>
      </div>
    </div>
  )}
</Modal>
    </div>
  )
}


function PurchaseDetails({purchase}){
  const [items,setItems]=useState([])
  const toast = useToast()
  useEffect(()=>{(async()=>{
    if(!purchase?.id) return
    const r = await supabase
      .from('purchase_items')
      .select('id,qty,unit_cost,line_total,expiry_date, products(trade_name_en,strength,dosage_form), inventory_batches(purchase_price,qty_on_hand)')
      .eq('purchase_id', purchase.id)
      .order('created_at',{ascending:true})
    if(r.error) toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setItems(r.data||[])
  })()},[purchase?.id])

  if(!purchase) return null
  return (
    <div className="col" style={{gap:10}}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <div><b>{purchase.invoice_no||'—'}</b></div>
        <div className="hint">{purchase.purchase_date}</div>
      </div>
      <div className="hint">Supplier: {purchase.suppliers?.name || '—'}</div>
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th style={{width:110}}>Qty</th>
            <th style={{width:140}}>Cost</th>
            <th style={{width:140}}>Total</th>
            <th style={{width:130}}>Exp</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it=>(
            <tr key={it.id}>
              <td className="hint">{it.products?.trade_name_en} {it.products?.strength ? `• ${it.products.strength}`:''}</td>
              <td className="hint">{it.qty}</td>
              <td className="hint">{Number(it.unit_cost||0).toFixed(2)}</td>
              <td className="hint">{Number(it.line_total||0).toFixed(2)}</td>
              <td className="hint">{it.expiry_date||'—'}</td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={5} className="hint">No items.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
