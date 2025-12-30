import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../state/auth'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { Modal } from '../ui/modal'

function empty(){
  return { id:null, name:'', phone:'', notes:'' }
}

export function SuppliersPage(){
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const [q,setQ]=useState('')
  const [rows,setRows]=useState([])
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState(empty())

  async function load(){
    if(!activeBranchId) return
    const r = await supabase
      .from('suppliers')
      .select('id,name,phone,notes,created_at')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:false})
      .limit(2000)
    if(r.error) toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setRows(r.data||[])
  }
  useEffect(()=>{ load() },[activeBranchId])

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return rows
    return rows.filter(r => (r.name+' '+(r.phone||'')+' '+(r.notes||'')).toLowerCase().includes(s))
  },[rows,q])

  function edit(r){
    setForm({ id:r.id, name:r.name||'', phone:r.phone||'', notes:r.notes||'' })
    setOpen(true)
  }

  function create(){
    setForm(empty())
    setOpen(true)
  }

  async function save(){
    if(!activeBranchId) return
    const name = String(form.name||'').trim()
    if(!name) return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'اكتب اسم المورد',en:'Enter supplier name'})
    const payload = { branch_id: activeBranchId, name, phone: form.phone||null, notes: form.notes||null }

    const r = form.id
      ? await supabase.from('suppliers').update(payload).eq('id', form.id)
      : await supabase.from('suppliers').insert(payload)

    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحفظ',en:'Saved'})
    setOpen(false)
    setForm(empty())
    load()
  }

  async function remove(id){
    const r = await supabase.from('suppliers').delete().eq('id', id)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحذف',en:'Deleted'})
    load()
  }

  return (
    <div className="col">
      <div className="card">
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{t.suppliers}</div>
          <div className="row" style={{gap:10}}>
            <input className="input" style={{width:260}} value={q} onChange={e=>setQ(e.target.value)} placeholder={t.search}/>
            <button className="btn btnPrimary" onClick={create}>{t.addSupplier}</button>
          </div>
        </div>
        <div className="cardBody" style={{overflow:'auto', maxHeight:520}}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.supplier}</th>
                <th>Phone</th>
                <th>Notes</th>
                <th style={{width:140}}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td className="hint">{r.phone||'—'}</td>
                  <td className="hint">{r.notes||'—'}</td>
                  <td>
                    <div className="row" style={{gap:8,justifyContent:'flex-end'}}>
                      <button className="btn" onClick={()=>edit(r)} title={t.update}>✎</button>
                      <button className="btn btnDanger" onClick={()=>remove(r.id)} title={t.delete}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={4} className="hint">No rows.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title={form.id ? 'Edit supplier' : 'New supplier'}>
        <div className="col" style={{gap:10}}>
          <div>
            <div className="label">{t.supplier}</div>
            <input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          </div>
          <div>
            <div className="label">Phone</div>
            <input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          </div>
          <div>
            <div className="label">Notes</div>
            <textarea className="textarea" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
          </div>
          <div className="row" style={{gap:10,justifyContent:'flex-end'}}>
            <button className="btn" onClick={()=>setOpen(false)}>{t.cancel}</button>
            <button className="btn btnPrimary" onClick={save}>{t.save}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
