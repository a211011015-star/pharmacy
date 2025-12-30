import React, { useMemo, useState } from 'react'

/**
 * ScientificMultiSelect
 * - Search/filter instead of long select list
 * - Multi select (chips)
 *
 * props:
 * - options: [{id, scientific_en}]
 * - value: string[] (scientific ids)
 * - onChange: (ids:string[]) => void
 * - placeholder
 */
export function ScientificMultiSelect({ options=[], value=[], onChange, placeholder='Search scientific...' }){
  const [q,setQ]=useState('')

  const selectedSet = useMemo(()=> new Set(value||[]), [value])
  const selected = useMemo(()=> options.filter(o=>selectedSet.has(o.id)), [options, selectedSet])
  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return options.slice(0,40)
    return options.filter(o=> (o.scientific_en||'').toLowerCase().includes(s)).slice(0,60)
  },[options,q])

  function add(id){
    if(selectedSet.has(id)) return
    const next=[...(value||[]), id]
    onChange(next)
    setQ('')
  }

  function remove(id){
    const next=(value||[]).filter(x=>x!==id)
    onChange(next)
  }

  return (
    <div>
      <input
        className="input"
        value={q}
        onChange={(e)=>setQ(e.target.value)}
        placeholder={placeholder}
      />

      {selected.length>0 && (
        <div className="row" style={{gap:8, flexWrap:'wrap', marginTop:8}}>
          {selected.map(s=>(
            <span key={s.id} className="badge" style={{display:'inline-flex', alignItems:'center', gap:8}}>
              {s.scientific_en}
              <button className="btn" style={{padding:'2px 8px'}} onClick={()=>remove(s.id)} title="Remove">×</button>
            </span>
          ))}
        </div>
      )}

      <div style={{marginTop:8, maxHeight:220, overflow:'auto', border:'1px solid var(--border)', borderRadius:12}}>
        {filtered.map(o=>(
          <div
            key={o.id}
            className="row"
            style={{
              padding:'10px 12px',
              borderBottom:'1px solid var(--border)',
              justifyContent:'space-between',
              cursor:'pointer',
              background: selectedSet.has(o.id) ? 'rgba(13,148,136,.08)' : 'transparent'
            }}
            onClick={()=>add(o.id)}
          >
            <div>{o.scientific_en}</div>
            <div className="hint">{selectedSet.has(o.id) ? 'Selected' : 'Add'}</div>
          </div>
        ))}
        {!filtered.length && <div className="hint" style={{padding:10}}>No results.</div>}
      </div>
    </div>
  )
}
