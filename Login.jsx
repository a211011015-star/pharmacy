import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'
import { LanguageToggle } from '../ui/LanguageToggle'

export function LoginPage(){
  const toast = useToast()
  const { t } = useI18n()

  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [mode,setMode]=useState('login') // login | signup

  async function submit(){
    if(!email || !password){
      return toast.show({titleAr:'تنبيه',titleEn:'Notice',ar:'أدخل البريد وكلمة المرور',en:'Enter email and password'})
    }
    if(mode==='login'){
      const r = await supabase.auth.signInWithPassword({ email, password })
      if(r.error) toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    }else{
      const r = await supabase.auth.signUp({ email, password })
      if(r.error) toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
      else toast.show({titleAr:'تم',titleEn:'OK',ar:'تم إنشاء الحساب، قم بتسجيل الدخول',en:'Account created. Please login.'})
    }
  }

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authLeft">
          <div className="brand">Qatfah</div>
          <div className="hint">PRO Pharmacy Management</div>
        </div>

        <div className="authRight">
          <div className="row" style={{justifyContent:'space-between',marginBottom:10}}>
            <div style={{fontWeight:900,fontSize:18}}>{mode==='login' ? 'Login' : 'Signup'}</div>
            <LanguageToggle />
          </div>

          <div className="label">Email</div>
          <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />

          <div className="label" style={{marginTop:10}}>Password</div>
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} />

          <button className="btn btnPrimary" style={{marginTop:12,width:'100%'}} onClick={submit}>
            {mode==='login' ? 'Login' : 'Signup'}
          </button>

          <button className="btn" style={{marginTop:10,width:'100%'}} onClick={()=>setMode(mode==='login'?'signup':'login')}>
            {mode==='login' ? 'Create account' : 'Have account? Login'}
          </button>
        </div>
      </div>
    </div>
  )
}
