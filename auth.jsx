import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const Ctx = createContext(null)

export function AuthProvider({children}){
  const [session,setSession]=useState(null)
  const [branches,setBranches]=useState([])
  const [memberships,setMemberships]=useState([])
  const [activeBranchId,setActiveBranchId]=useState(null)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>sub.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    async function load(){
      if(!session?.user){
        setBranches([])
        setMemberships([])
        setActiveBranchId(null)
        setLoading(false)
        return
      }
      setLoading(true)

      const r = await supabase
        .from('user_branches')
        .select('branch_id,is_default,is_owner,can_view_profit,can_edit_prices,can_edit_clinical,can_settings, branches:branch_id(id,name_ar,name_en)')
        .order('is_default',{ascending:false})
        .limit(50)

      if(r.error){
        setBranches([])
        setMemberships([])
        setActiveBranchId(null)
        setLoading(false)
        return
      }

      const mem = (r.data||[]).map(x=>({
        branch_id: x.branch_id,
        is_default: !!x.is_default,
        is_owner: !!x.is_owner,
        can_view_profit: !!x.can_view_profit,
        can_edit_prices: !!x.can_edit_prices,
        can_edit_clinical: !!x.can_edit_clinical,
        can_settings: !!x.can_settings,
      }))
      setMemberships(mem)

      const list = (r.data||[]).map(x=>({
        id: x.branches?.id || x.branch_id,
        name_ar: x.branches?.name_ar || 'فرع',
        name_en: x.branches?.name_en || 'Branch',
        is_default: !!x.is_default
      }))
      setBranches(list)

      const def = (list.find(x=>x.is_default) || list[0])?.id || null
      setActiveBranchId(def)
      setLoading(false)
    }
    load()
  },[session?.user?.id])

  const activeMembership = useMemo(()=> memberships.find(x=>x.branch_id===activeBranchId) || null, [memberships,activeBranchId])

  function can(flag){
    if(!activeMembership) return false
    if(activeMembership.is_owner) return true
    return !!activeMembership[flag]
  }

  const value = useMemo(()=>({
    session,
    branches,
    memberships,
    activeBranchId,
    setActiveBranchId,
    activeMembership,
    can,
    loading,
    signIn:(email,password)=>supabase.auth.signInWithPassword({email,password}),
    signOut:()=>supabase.auth.signOut()
  }),[session,branches,memberships,activeBranchId,activeMembership,loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(){ return useContext(Ctx) }
