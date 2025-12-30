import React, { useEffect, useState } from 'react'
import { useAuth } from '../state/auth'
import { useToast } from '../ui/toast'
import { supabase } from '../lib/supabase'
import { useI18n } from '../state/i18n'

export function SettingsPage(){
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const [currency,setCurrency]=useState({ symbol:'IQD', decimals:0 })
  const [templates,setTemplates]=useState([])
  const [defaults,setDefaults]=useState({ purchase_a4:'', sale_80:'' })

  useEffect(()=>{ load() },[activeBranchId])

  async function load(){
    if(!activeBranchId) return

    const s = await supabase.from('app_settings')
      .select('*')
      .eq('branch_id', activeBranchId)
      .in('key', ['currency','default_purchase_a4_template_id','default_sale_80_template_id'])
      .limit(50)

    if(s.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:s.error.message,en:s.error.message})

    const cur = (s.data||[]).find(x=>x.key==='currency')?.value_json
    if(cur) setCurrency(cur)

    setDefaults({
      purchase_a4: (s.data||[]).find(x=>x.key==='default_purchase_a4_template_id')?.value_text || '',
      sale_80: (s.data||[]).find(x=>x.key==='default_sale_80_template_id')?.value_text || ''
    })

    const tpls = await supabase.from('print_templates')
      .select('id,name,doc_type,paper_size,orientation,is_default')
      .eq('branch_id', activeBranchId)
      .order('created_at',{ascending:false})
      .limit(500)

    if(!tpls.error) setTemplates(tpls.data||[])
  }

  async function saveCurrency(){
    if(!activeBranchId) return
    const r = await supabase.from('app_settings').upsert({
      branch_id: activeBranchId,
      key: 'currency',
      value_json: currency
    }, { onConflict:'branch_id,key' })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم حفظ العملة',en:'Currency saved'})
  }

  async function saveDefaults(){
    if(!activeBranchId) return
    const payload = [
      { branch_id: activeBranchId, key:'default_purchase_a4_template_id', value_text: defaults.purchase_a4 || null },
      { branch_id: activeBranchId, key:'default_sale_80_template_id', value_text: defaults.sale_80 || null },
    ]
    const r = await supabase.from('app_settings').upsert(payload, { onConflict:'branch_id,key' })
    if(r.error) return toast.show({titleAr:'خطأ',titleEn:'Error',ar:r.error.message,en:r.error.message})
    toast.show({titleAr:'تم',titleEn:'OK',ar:'تم حفظ القوالب الافتراضية',en:'Defaults saved'})
  }

  const purchaseA4 = templates.filter(x=>String(x.paper_size||'').toUpperCase()==='A4' && String(x.doc_type||'').toLowerCase()==='purchase')
  const sale80 = templates.filter(x=>String(x.paper_size||'')==='80' && String(x.doc_type||'').toLowerCase()==='sale')

  return (
    <div className="grid">
      <div className="card">
        <div className="cardHeader">{t.settings}</div>
        <div className="cardBody">
          <div className="grid grid2">
            <div className="card">
              <div className="cardHeader">{t.currency}</div>
              <div className="cardBody">
                <div className="label">Symbol</div>
                <input className="input" value={currency.symbol} onChange={e=>setCurrency({...currency,symbol:e.target.value})}/>
                <div className="label" style={{marginTop:10}}>Decimals</div>
                <input className="input" value={currency.decimals} onChange={e=>setCurrency({...currency,decimals:Number(e.target.value||0)})}/>
                <button className="btn btnPrimary" style={{marginTop:12}} onClick={saveCurrency}>{t.save}</button>
              </div>
            </div>

            <div className="card">
              <div className="cardHeader">{t.print} — {t.templates}</div>
              <div className="cardBody">
                <div className="hint" style={{marginBottom:10}}>
                  ويزارد الطباعة المتقدم موجود في صفحة Print Designer: اختر العناصر من قائمة العناصر ثم رتبها على Canvas.
                </div>

                <div className="label">{t.purchaseA4}</div>
                <select className="select" value={defaults.purchase_a4} onChange={(e)=>setDefaults({...defaults,purchase_a4:e.target.value})} style={{width:'100%'}}>
                  <option value="">--</option>
                  {purchaseA4.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
                </select>

                <div className="label" style={{marginTop:10}}>{t.sale80}</div>
                <select className="select" value={defaults.sale_80} onChange={(e)=>setDefaults({...defaults,sale_80:e.target.value})} style={{width:'100%'}}>
                  <option value="">--</option>
                  {sale80.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
                </select>

                <div className="row" style={{gap:10,marginTop:12}}>
                  <button className="btn btnPrimary" onClick={saveDefaults}>{t.save}</button>
                  <a className="btn" href="#/print-designer">{t.openDesigner}</a>
                </div>
              </div>
            </div>
          </div>

          <div className="hint" style={{marginTop:10}}>
            ملاحظة: الطباعة في POS بدون معاينة. تستطيع اختيار القالب الافتراضي هنا.
          </div>
        </div>
      </div>
    </div>
  )
}
