import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../state/auth'
import { supabase } from '../lib/supabase'
import { money } from '../ui/format'
import * as XLSX from 'xlsx'

export function ReportsPage(){
  const { activeBranchId } = useAuth()
  const [from,setFrom]=useState('')
  const [to,setTo]=useState('')
  const [rows,setRows]=useState([])

  async function run(){
    if(!activeBranchId) return
    let q=supabase.from('sales').select('created_at,list_ref,grand_total,cogs_total,profit_total').eq('branch_id',activeBranchId).order('created_at',{ascending:false}).limit(500)
    if(from) q=q.gte('created_at',from+'T00:00:00Z')
    if(to) q=q.lte('created_at',to+'T23:59:59Z')
    const { data } = await q
    setRows(data||[])
  }
  useEffect(()=>{run()},[activeBranchId])

  const totals=useMemo(()=>({
  revenue: rows.reduce((a,x)=>a+Number(x.grand_total||0),0),
  cogs: rows.reduce((a,x)=>a+Number(x.cogs_total||0),0),
  profit: rows.reduce((a,x)=>a+Number(x.profit_total||0),0),
  count: rows.length
}),[rows])

  function exportExcel(){
    const ws=XLSX.utils.json_to_sheet(rows)
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'sales_profit'); XLSX.writeFile(wb,'report_sales_profit.xlsx')
  }

  return (
    <div className="card">
      <div className="cardHeader row" style={{justifyContent:'space-between'}}>
        <div style={{fontWeight:900}}>Reports (FIFO Profit)</div>
        <div className="row" style={{flexWrap:'wrap'}}>
          <input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          <input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)}/>
          <button className="btn" onClick={run}>Run</button>
          <button className="btn" onClick={exportExcel}>Export Excel</button>
          <button className="btn btnPrimary" onClick={()=>window.print()}>Print</button>
        </div>
      </div>
      <div className="cardBody">
        <div className="grid grid3">
          <div className="card"><div className="cardBody"><div className="label">Revenue</div><div className="kpi">{money(totals.revenue)}</div></div></div>
          <div className="card"><div className="cardBody"><div className="label">COGS</div><div className="kpi">{money(totals.cogs)}</div></div></div>
          <div className="card"><div className="cardBody"><div className="label">Profit</div><div className="kpi">{money(totals.profit)}</div></div></div>
        </div>
        <table className="table" style={{marginTop:12}}>
          <thead><tr><th>Time</th><th>Ref</th><th>Revenue</th><th>COGS</th><th>Profit</th></tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.list_ref}>
                <td className="hint">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.list_ref}</td><td>{money(r.grand_total)}</td><td>{money(r.cogs_total)}</td><td>{money(r.profit_total)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="hint">لا توجد بيانات.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
