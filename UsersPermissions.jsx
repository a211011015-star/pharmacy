import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../state/auth'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'

export function UsersPermissionsPage(){
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const [rows,setRows]=useState([])
  const [newUserId,setNewUserId]=useState('')

  useEffect(()=>{ load() },[activeBranchId])

  async function load(){
    if(!activeBranchId) return
    const r = await supabase
      .from('user_branches')
      .select('user_id,branch_id,is_default,is_owner,can_view_profit,can_edit_prices,can_edit_clinical,can_settings,created_at')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:true})
      .limit(200)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setRows(r.data||[])
  }

  async function add(){
    if(!activeBranchId) return
    const uid = newUserId.trim()
    if(!uid) return
    const r = await supabase.from('user_branches').insert({
      user_id: uid,
      branch_id: activeBranchId,
      is_default: false,
      is_owner: false,
      can_view_profit: false,
      can_edit_prices: false,
      can_edit_clinical: false,
      can_settings: false
    })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setNewUserId('')
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تمت الإضافة',en:'Added'})
    load()
  }

  async function toggle(uid, key, value){
    const r = await supabase
      .from('user_branches')
      .update({ [key]: value })
      .eq('branch_id', activeBranchId)
      .eq('user_id', uid)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    setRows(prev=> prev.map(x=> x.user_id===uid ? {...x,[key]:value} : x))
  }

  async function remove(uid){
    const r = await supabase.from('user_branches').delete().eq('branch_id', activeBranchId).eq('user_id', uid)
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم الحذف',en:'Removed'})
    load()
  }

  return (
    <div className="card">
      <div className="cardHeader">Users & Permissions</div>
      <div className="cardBody">
        <div className="hint" style={{marginBottom:10}}>
          نظام مبسط: مالك واحد + أعلام صلاحيات على مستوى الفرع. هذه الصفحة للمالك فقط (RLS).
        </div>

        <div className="row" style={{gap:10,flexWrap:'wrap',marginBottom:12}}>
          <input className="input" style={{width:360}} value={newUserId} onChange={(e)=>setNewUserId(e.target.value)} placeholder="User UUID (auth.users.id)" />
          <button className="btn btnPrimary" onClick={add}>{t.create}</button>
          <button className="btn" onClick={load}>Refresh</button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Owner</th>
              <th>{t.reports} (Profit)</th>
              <th>Prices</th>
              <th>{t.scientifics}</th>
              <th>{t.settings}</th>
              <th style={{width:80}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.user_id}>
                <td className="hint">{r.user_id}</td>
                <td>
                  <input type="checkbox" checked={!!r.is_owner} onChange={(e)=>toggle(r.user_id,'is_owner',e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={!!r.can_view_profit} onChange={(e)=>toggle(r.user_id,'can_view_profit',e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={!!r.can_edit_prices} onChange={(e)=>toggle(r.user_id,'can_edit_prices',e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={!!r.can_edit_clinical} onChange={(e)=>toggle(r.user_id,'can_edit_clinical',e.target.checked)} />
                </td>
                <td>
                  <input type="checkbox" checked={!!r.can_settings} onChange={(e)=>toggle(r.user_id,'can_settings',e.target.checked)} />
                </td>
                <td><button className="btn btnDanger" onClick={()=>remove(r.user_id)}>{t.delete}</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="hint">No users.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
