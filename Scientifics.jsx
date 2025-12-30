import React, { useEffect, useMemo, useState } from 'react'
import { supabase, SUPABASE_CONFIG_OK } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'

const severities = [
  {code:'low', label:'Low'},
  {code:'moderate', label:'Moderate'},
  {code:'high', label:'High'},
]

function empty(){
  return { id:null, scientific_en:'', info:'', liver:'', kidney:'', pregnancy:'', lactation:'' }
}

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

export function ScientificsPage(){
  const toast = useToast()
  const { t } = useI18n()

  const [q,setQ]=useState('')
  const [rows,setRows]=useState([])
  const [form,setForm]=useState(empty())

  const [intOpen,setIntOpen]=useState(false)
  const [intTarget,setIntTarget]=useState(null)
  const [intRows,setIntRows]=useState([])
  const [intForm,setIntForm]=useState({ other_id:'', severity:'moderate', comment:'' })

  useEffect(()=>{ load() },[])

  async function load(){
    if(!SUPABASE_CONFIG_OK){
      setRows([])
      return
    }
    try{
      const r = await supabase
        .from('scientifics')
        .select('id,scientific_en,info,liver,kidney,pregnancy,lactation,created_at')
        .order('scientific_en',{ascending:true})
        .limit(5000)

      if(r.error) throw r.error
      setRows(r.data||[])
    }catch(e){
      const msg = e?.message || String(e)
      toast.show({
        titleAr:'خطأ',
        titleEn:'Error',
        ar: msg.includes('Failed to fetch')
          ? 'فشل الاتصال بـ Supabase. تأكد من وضع VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY الصحيحين داخل ملف web/.env ثم أعد تشغيل npm run dev.'
          : msg,
        en: msg.includes('Failed to fetch')
          ? 'Failed to reach Supabase. Set correct VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in web/.env then restart npm run dev.'
          : msg
      })
    }
  }

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return rows
    return rows.filter(r=>{
      return (r.scientific_en+' '+(r.info||'')+' '+(r.pregnancy||'')+' '+(r.lactation||'')).toLowerCase().includes(s)
    })
  },[rows,q])

  function edit(r){
    setForm({
      id: r.id,
      scientific_en: r.scientific_en||'',
      info: r.info||'',
      liver: r.liver||'',
      kidney: r.kidney||'',
      pregnancy: r.pregnancy||'',
      lactation: r.lactation||'',
    })
  }

  async function save(){
    if(!SUPABASE_CONFIG_OK) return
    const scientific_en = String(form.scientific_en||'').trim()
    if(!scientific_en) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب الاسم العلمي EN',en:'Enter scientific EN'})

    const payload = {
      scientific_en,
      info: form.info || null,
      liver: form.liver || null,
      kidney: form.kidney || null,
      pregnancy: form.pregnancy || null,
      lactation: form.lactation || null,
    }

    try{
      const r = form.id
        ? await supabase.from('scientifics').update(payload).eq('id', form.id)
        : await supabase.from('scientifics').insert(payload)

      if(r.error) throw r.error
      toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحفظ',en:'Saved'})
      setForm(empty())
      load()
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  async function remove(id){
    if(!SUPABASE_CONFIG_OK) return
    try{
      const r = await supabase.from('scientifics').delete().eq('id', id)
      if(r.error) throw r.error
      toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحذف',en:'Deleted'})
      if(form.id===id) setForm(empty())
      load()
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  async function openInteractions(r){
    if(!SUPABASE_CONFIG_OK) return
    setIntTarget(r)
    setIntForm({ other_id:'', severity:'moderate', comment:'' })
    setIntOpen(true)

    try{
      const x = await supabase
        .from('scientific_interactions')
        .select('id,scientific_a_id,scientific_b_id,severity,comment, a:scientific_a_id(scientific_en), b:scientific_b_id(scientific_en)')
        .or(`scientific_a_id.eq.${r.id},scientific_b_id.eq.${r.id}`)
        .order('severity',{ascending:false})
        .limit(500)

      if(x.error) throw x.error
      setIntRows(x.data||[])
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
      setIntRows([])
    }
  }

  async function addInteraction(){
    if(!SUPABASE_CONFIG_OK) return
    if(!intTarget?.id) return
    const other = intForm.other_id
    if(!other) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اختر اسم علمي',en:'Select a scientific'})
    if(other===intTarget.id) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'لا يمكن نفس الاسم',en:'Cannot be same'})

    const a = (intTarget.id < other) ? intTarget.id : other
    const b = (intTarget.id < other) ? other : intTarget.id
    const payload = { scientific_a_id: a, scientific_b_id: b, severity: intForm.severity, comment: intForm.comment || null }

    try{
      const r = await supabase.from('scientific_interactions').insert(payload)
      if(r.error) throw r.error
      toast.show({titleAr:'تم',titleEn:'OK',ar:'تمت الإضافة',en:'Added'})
      openInteractions(intTarget)
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  async function removeInteraction(id){
    if(!SUPABASE_CONFIG_OK) return
    try{
      const r = await supabase.from('scientific_interactions').delete().eq('id', id)
      if(r.error) throw r.error
      toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحذف',en:'Deleted'})
      openInteractions(intTarget)
    }catch(e){
      const msg=e?.message||String(e)
      toast.show({titleAr:'خطأ',titleEn:'Error',ar:msg,en:msg})
    }
  }

  return (
    <div className="grid grid2">
      <div className="card">
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{t.scientifics}</div>
          <div className="row" style={{gap:10}}>
            <input className="input" style={{width:260}} value={q} onChange={e=>setQ(e.target.value)} placeholder={t.search}/>
            <button className="btn" onClick={load}>Refresh</button>
          </div>
        </div>

        {!SUPABASE_CONFIG_OK && (
          <div className="cardBody">
            <div className="hint">
              Supabase غير مضبوط. افتح الملف: <b>web/.env</b> وضع:
              <div className="hint" style={{marginTop:8}}>
                VITE_SUPABASE_URL=...<br/>
                VITE_SUPABASE_ANON_KEY=...
              </div>
              ثم أعد تشغيل السيرفر: <b>npm run dev</b>
            </div>
          </div>
        )}

        {SUPABASE_CONFIG_OK && (
          <div className="cardBody" style={{maxHeight:560,overflow:'auto'}}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{minWidth:220}}>{t.scientific} EN</th>
                  <th>{t.info}</th>
                  <th style={{width:150}}>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r.id}>
                    <td><b>{r.scientific_en}</b></td>
                    <td className="hint">{(r.info||'').slice(0,120)}{(r.info||'').length>120?'…':''}</td>
                    <td>
                      <div className="row" style={{gap:8,justifyContent:'flex-end'}}>
                        <button className="btn" onClick={()=>openInteractions(r)} title="Interactions">⇄</button>
                        <button className="btn" onClick={()=>edit(r)} title={t.update}>✎</button>
                        <button className="btn btnDanger" onClick={()=>remove(r.id)} title={t.delete}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan={3} className="hint">No rows.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="cardHeader">{form.id ? t.update : t.create}</div>
        <div className="cardBody">
          <div className="label">{t.scientific} EN</div>
          <input className="input" value={form.scientific_en} onChange={e=>setForm({...form,scientific_en:e.target.value})} placeholder="e.g. Amoxicillin" />

          <div className="label" style={{marginTop:10}}>{t.info}</div>
          <textarea className="textarea" value={form.info} onChange={e=>setForm({...form,info:e.target.value})} style={{minHeight:120}} />

          <div className="grid grid2" style={{marginTop:10}}>
            <div>
              <div className="label">{t.liver}</div>
              <textarea className="textarea" value={form.liver} onChange={e=>setForm({...form,liver:e.target.value})} style={{minHeight:90}} />
            </div>
            <div>
              <div className="label">{t.kidney}</div>
              <textarea className="textarea" value={form.kidney} onChange={e=>setForm({...form,kidney:e.target.value})} style={{minHeight:90}} />
            </div>
          </div>

          <div className="grid grid2" style={{marginTop:10}}>
            <div>
              <div className="label">{t.pregnancy}</div>
              <textarea className="textarea" value={form.pregnancy} onChange={e=>setForm({...form,pregnancy:e.target.value})} style={{minHeight:90}} />
            </div>
            <div>
              <div className="label">{t.lactation}</div>
              <textarea className="textarea" value={form.lactation} onChange={e=>setForm({...form,lactation:e.target.value})} style={{minHeight:90}} />
            </div>
          </div>

          <div className="row" style={{gap:10,marginTop:12}}>
            <button className="btn btnPrimary" onClick={save}>{t.save}</button>
            <button className="btn" onClick={()=>setForm(empty())}>Clear</button>
          </div>

          <div className="hint" style={{marginTop:10}}>
            الأفضل إدخال EN فقط.
          </div>
        </div>
      </div>

      <Modal open={intOpen} title={`Interactions: ${intTarget?.scientific_en||''}`} onClose={()=>setIntOpen(false)}>
        <div className="grid grid2">
          <div>
            <div className="label">Other Scientific</div>
            <select className="select" value={intForm.other_id} onChange={e=>setIntForm({...intForm,other_id:e.target.value})} style={{width:'100%'}}>
              <option value="">--</option>
              {rows.map(s=><option key={s.id} value={s.id}>{s.scientific_en}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Severity</div>
            <select className="select" value={intForm.severity} onChange={e=>setIntForm({...intForm,severity:e.target.value})} style={{width:'100%'}}>
              {severities.map(s=><option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="label" style={{marginTop:10}}>Comment</div>
        <textarea className="textarea" value={intForm.comment} onChange={e=>setIntForm({...intForm,comment:e.target.value})} style={{minHeight:90}} />

        <div className="row" style={{gap:10,marginTop:12}}>
          <button className="btn btnPrimary" onClick={addInteraction}>Add</button>
          <button className="btn" onClick={()=>setIntOpen(false)}>Close</button>
        </div>

        <div style={{marginTop:12}}>
          <table className="table">
            <thead>
              <tr>
                <th style={{width:120}}>Severity</th>
                <th>A</th>
                <th>B</th>
                <th>Comment</th>
                <th style={{width:80}}></th>
              </tr>
            </thead>
            <tbody>
              {intRows.map(r=>(
                <tr key={r.id}>
                  <td className="hint">{r.severity}</td>
                  <td className="hint">{r.a?.scientific_en}</td>
                  <td className="hint">{r.b?.scientific_en}</td>
                  <td className="hint">{r.comment||'—'}</td>
                  <td><button className="btn btnDanger" onClick={()=>removeInteraction(r.id)}>🗑</button></td>
                </tr>
              ))}
              {!intRows.length && <tr><td colSpan={5} className="hint">No interactions.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}
