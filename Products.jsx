import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../state/auth'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { BarcodeInput } from '../ui/BarcodeInput'
import { ScientificMultiSelect } from '../ui/ScientificMultiSelect'

const DOSAGE_FORMS = [
  {code:'TAB', en:'Tablet'},
  {code:'CAP', en:'Capsule'},
  {code:'SYR', en:'Syrup'},
  {code:'SUS', en:'Suspension'},
  {code:'DROP', en:'Drops'},
  {code:'INJ', en:'Injection'},
  {code:'CRM', en:'Cream'},
  {code:'ONG', en:'Ointment'},
]

const LIQUID_FORMS = new Set(['SYR','SUS','DROP'])
const STRENGTH_UNITS = ['mg','g','mcg','IU','%']
const PER_UNITS = ['mL','L']

function empty(){
  return {
    id:null,
    trade_name_en:'',
    trade_name_ar:'',
    scientific_ids:[],
    dosage_form:'TAB',
    strength_value:'',
    strength_unit:'mg',
    per_value:'5',
    per_unit:'mL',
    default_selling_price:'',
    barcode:'',
  }
}

function buildStrength(f){
  const v = String(f.strength_value||'').trim()
  if(!v) return null
  const unit = String(f.strength_unit||'').trim() || 'mg'
  if(LIQUID_FORMS.has(f.dosage_form)){
    const pv = String(f.per_value||'').trim() || '5'
    const pu = String(f.per_unit||'').trim() || 'mL'
    return `${v} ${unit}/${pv} ${pu}`
  }
  return `${v} ${unit}`
}

export function ProductsPage(){
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const [q,setQ]=useState('')
  const [rows,setRows]=useState([])
  const [barcodes,setBarcodes]=useState([])
  const [scientifics,setScientifics]=useState([])
  const [mapPS,setMapPS]=useState({}) // product_id => [scientific_id]
  const [form,setForm]=useState(empty())

  useEffect(()=>{ load() },[activeBranchId])

  async function load(){
    if(!activeBranchId) return

    const p = await supabase
      .from('products')
      .select('id,trade_name_en,trade_name_ar,scientific_id,strength,dosage_form,default_selling_price,is_active,created_at, sci:scientific_id(scientific_en)')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:false})
      .limit(2000)

    if(p.error) toast.show({titleAr:'خطأ',titleEn:'Error',ar:p.error.message,en:p.error.message})
    setRows(p.data||[])

    const b = await supabase
      .from('product_barcodes')
      .select('id,product_id,barcode')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:false})
      .limit(5000)

    if(!b.error) setBarcodes(b.data||[])

    const s = await supabase.from('scientifics').select('id,scientific_en').order('scientific_en',{ascending:true}).limit(5000)
    if(!s.error) setScientifics(s.data||[])

    const m = await supabase
      .from('product_scientifics')
      .select('product_id,scientific_id')
      .eq('branch_id', activeBranchId)
      .limit(20000)

    if(!m.error){
      const mp={}
      for(const r of (m.data||[])){
        if(!mp[r.product_id]) mp[r.product_id]=[]
        mp[r.product_id].push(r.scientific_id)
      }
      setMapPS(mp)
    }else{
      // table may not exist yet (if SQL not applied)
      setMapPS({})
    }
  }

  const barcodeByProduct = useMemo(()=>{
    const m=new Map()
    for(const b of barcodes){
      if(!m.has(b.product_id)) m.set(b.product_id, b.barcode)
    }
    return m
  },[barcodes])

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return rows
    return rows.filter(r=>{
      const bc = barcodeByProduct.get(r.id)||''
      const sci = r.sci?.scientific_en || ''
      return (r.trade_name_en+' '+r.trade_name_ar+' '+sci+' '+bc).toLowerCase().includes(s)
    })
  },[rows,q,barcodeByProduct])

  function edit(r){
    const ids = mapPS[r.id] || (r.scientific_id ? [r.scientific_id] : [])
    setForm({
      id: r.id,
      trade_name_en: r.trade_name_en||'',
      trade_name_ar: r.trade_name_ar||'',
      scientific_ids: ids,
      dosage_form: r.dosage_form || 'TAB',
      strength_value: (r.strength||'').split(' ')[0] || '',
      strength_unit: (r.strength||'').split(' ')[1]?.split('/')[0] || 'mg',
      per_value: '5',
      per_unit: 'mL',
      default_selling_price: String(r.default_selling_price ?? ''),
      barcode: barcodeByProduct.get(r.id) || ''
    })
  }

  async function save(){
    if(!activeBranchId) return
    const trade_name_en = String(form.trade_name_en||'').trim()
    if(!trade_name_en) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب الاسم EN',en:'Enter EN name'})

    const strength = buildStrength(form)

    const scientific_ids = (form.scientific_ids||[]).filter(Boolean)
    const primary_scientific = scientific_ids[0] || null

    const payload = {
      branch_id: activeBranchId,
      trade_name_en,
      trade_name_ar: String(form.trade_name_ar||'').trim() || trade_name_en,
      scientific_id: primary_scientific,
      dosage_form: form.dosage_form || null,
      strength,
      default_selling_price: Number(form.default_selling_price||0)
    }

    const r = form.id
      ? await supabase.from('products').update(payload).eq('id', form.id)
      : await supabase.from('products').insert(payload).select('id').single()

    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})

    const pid = form.id || r.data?.id

    // upsert barcode (single primary)
    const bc = String(form.barcode||'').trim()
    if(bc && pid){
      const existing = barcodes.find(x=>x.product_id===pid)
      if(existing){
        const rb = await supabase.from('product_barcodes').update({barcode:bc}).eq('id', existing.id)
        if(rb.error) toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'فشل حفظ الباركود: '+rb.error.message,en:'Barcode failed: '+rb.error.message})
      }else{
        const rb = await supabase.from('product_barcodes').insert({branch_id:activeBranchId, product_id:pid, barcode:bc})
        if(rb.error) toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'فشل حفظ الباركود: '+rb.error.message,en:'Barcode failed: '+rb.error.message})
      }
    }

    // multi scientific mapping
    if(pid){
      // if table exists
      const del = await supabase.from('product_scientifics').delete().eq('branch_id', activeBranchId).eq('product_id', pid)
      if(!del.error && scientific_ids.length){
        const ins = await supabase.from('product_scientifics').insert(scientific_ids.map(sid=>({
          branch_id: activeBranchId,
          product_id: pid,
          scientific_id: sid
        })))
        if(ins.error){
          toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'فشل حفظ الربط العلمي: '+ins.error.message,en:'Scientific map failed: '+ins.error.message})
        }
      }
    }

    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحفظ',en:'Saved'})
    setForm(empty())
    load()
  }

  async function remove(id){
    const r = await supabase.from('products').delete().eq('id', id)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحذف',en:'Deleted'})
    if(form.id===id) setForm(empty())
    load()
  }

  async function searchBarcode(code){
    if(!activeBranchId) return
    const r = await supabase.rpc('find_product_by_barcode', { p_branch_id: activeBranchId, p_barcode: code })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    const found=r.data?.[0]
    if(!found) return toast.show({titleAr:'غير موجود',titleEn:'Not found',ar:'لا يوجد هذا الباركود',en:'Barcode not found'})
    setQ(found.trade_name_en||'')
  }

  const isLiquid = LIQUID_FORMS.has(form.dosage_form)

  return (
    <div className="grid grid2">
      <div className="card">
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>Products</div>
          <div className="row" style={{gap:10}}>
            <BarcodeInput onScan={searchBarcode} />
            <input className="input" style={{width:240}} value={q} onChange={e=>setQ(e.target.value)} placeholder={t.search}/>
            <button className="btn" onClick={load}>Refresh</button>
          </div>
        </div>

        <div className="cardBody" style={{maxHeight:560,overflow:'auto'}}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.barcode}</th>
                <th>{t.trade} EN</th>
                <th>{t.scientific} EN</th>
                <th>{t.dosageForm}</th>
                <th>{t.strength}</th>
                <th>{t.sellingPrice}</th>
                <th style={{width:130}}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id}>
                  <td className="hint">{barcodeByProduct.get(r.id)||'—'}</td>
                  <td><b>{r.trade_name_en}</b></td>
                  <td className="hint">{r.sci?.scientific_en || '—'}</td>
                  <td className="hint">{r.dosage_form||'—'}</td>
                  <td className="hint">{r.strength||'—'}</td>
                  <td className="hint">{Number(r.default_selling_price||0).toFixed(2)}</td>
                  <td>
                    <div className="row" style={{gap:8,justifyContent:'flex-end'}}>
                      <button className="btn" onClick={()=>edit(r)} title={t.update}>✎</button>
                      <button className="btn btnDanger" onClick={()=>remove(r.id)} title={t.delete}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={7} className="hint">No rows.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="cardHeader">{form.id ? 'Edit' : 'Create'}</div>
        <div className="cardBody">

          <div className="label">{t.trade} EN</div>
          <input className="input" value={form.trade_name_en} onChange={e=>setForm({...form,trade_name_en:e.target.value})} />

          <div className="label" style={{marginTop:10}}>{t.barcode}</div>
          <input className="input" value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} />

          <div className="label" style={{marginTop:10}}>{t.scientific} (Multi)</div>
          <ScientificMultiSelect
            options={scientifics}
            value={form.scientific_ids}
            onChange={(ids)=>setForm({...form, scientific_ids: ids})}
            placeholder="Type to search scientific..."
          />

          <div className="grid grid2" style={{marginTop:10}}>
            <div>
              <div className="label">{t.dosageForm}</div>
              <select className="select" value={form.dosage_form} onChange={e=>setForm({...form,dosage_form:e.target.value})} style={{width:'100%'}}>
                {DOSAGE_FORMS.map(d=><option key={d.code} value={d.code}>{d.en}</option>)}
              </select>
            </div>
            <div>
              <div className="label">{t.sellingPrice}</div>
              <input className="input" value={form.default_selling_price} onChange={e=>setForm({...form,default_selling_price:e.target.value})} />
            </div>
          </div>

          <div className="grid grid2" style={{marginTop:10}}>
            <div>
              <div className="label">{t.strength}</div>
              <div className="row" style={{gap:10}}>
                <input className="input" value={form.strength_value} onChange={e=>setForm({...form,strength_value:e.target.value})} placeholder="e.g. 500" />
                <select className="select" value={form.strength_unit} onChange={e=>setForm({...form,strength_unit:e.target.value})} style={{width:140}}>
                  {STRENGTH_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {isLiquid ? (
              <div>
                <div className="label">Per (for liquids)</div>
                <div className="row" style={{gap:10}}>
                  <input className="input" value={form.per_value} onChange={e=>setForm({...form,per_value:e.target.value})} placeholder="e.g. 5" />
                  <select className="select" value={form.per_unit} onChange={e=>setForm({...form,per_unit:e.target.value})} style={{width:140}}>
                    {PER_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <div className="label">—</div>
                <div className="hint" style={{paddingTop:10}}>Liquids show “mg/5 mL”.</div>
              </div>
            )}
          </div>

          <div className="row" style={{gap:10,marginTop:12}}>
            <button className="btn btnPrimary" onClick={save}>{t.save}</button>
            <button className="btn" onClick={()=>setForm(empty())}>Clear</button>
          </div>

          <div className="hint" style={{marginTop:10}}>
            إدخال EN فقط: إذا تركت AR فارغاً سيُنسخ من EN.
          </div>
        </div>
      </div>
    </div>
  )
}
