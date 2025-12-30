import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../state/auth'
import { useToast } from '../ui/toast'
import { useI18n } from '../state/i18n'

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function paperDims(paper, orientation) {
  // simple pixel canvas sizes (editable)
  let w = 380, h = 760
  if (paper === '58') { w = 280; h = 760 }
  if (paper === '80') { w = 380; h = 760 }
  if (paper === 'A4') { w = 595; h = 842 }

  if (orientation === 'landscape') return { w: h, h: w }
  return { w, h }
}

function newEl(overrides = {}) {
  return {
    id: uid(),
    type: 'text',          // text | line | table | totals | qr | barcode | logo
    text: 'Text',
    x: 10,
    y: 10,
    w: 180,
    h: 34,
    align: 'left',         // left|center|right
    fontSize: 14,
    bold: false,
    ...overrides,
  }
}

function paperMargin(paper){
  if(paper==='58') return 8
  if(paper==='80') return 10
  return 24
}

function PreviewRender({ dims, paper, elements, title, subtitle }){
  const margin = paperMargin(paper)
  const safeW = Math.max(0, dims.w - margin*2)
  const safeH = Math.max(0, dims.h - margin*2)
  const scale = Math.min(1, 780 / dims.w)

  return (
    <div style={{overflow:'auto', padding: 8}}>
      <div style={{display:'flex', justifyContent:'center'}}>
        <div style={{transform:`scale(${scale})`, transformOrigin:'top center'}}>
          <div
            style={{
              width: dims.w,
              height: dims.h,
              background: '#fff',
              color: '#111',
              border: '1px solid rgba(0,0,0,0.18)',
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              position: 'relative',
            }}
          >
            {/* margin / safe area */}
            <div
              style={{
                position: 'absolute',
                left: margin,
                top: margin,
                width: safeW,
                height: safeH,
                outline: '1px dashed rgba(0,0,0,0.25)',
                pointerEvents: 'none'
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: margin,
                top: margin,
                width: safeW,
                height: safeH,
              }}
            >
              {/* header */}
              <div style={{position:'absolute', left:0, top:-margin+6, fontSize:11, opacity:0.75}}>
                {title}
                {subtitle ? <span style={{marginLeft:8}}>{subtitle}</span> : null}
              </div>

              {elements.map(el => {
                const base = {
                  position:'absolute',
                  right: el.x, // RTL canvas is right-based in this designer
                  top: el.y,
                  width: el.w,
                  height: el.h,
                  overflow:'hidden',
                  display:'flex',
                  alignItems:'center',
                  justifyContent: el.align==='center' ? 'center' : (el.align==='right' ? 'flex-end' : 'flex-start'),
                  fontSize: el.fontSize || 14,
                  fontWeight: el.bold ? 900 : 500,
                }

                if(el.type==='line'){
                  return <div key={el.id} style={{...base, height: 2, alignItems:'center'}}><div style={{width:'100%', height:1, background:'#111', opacity:0.35}} /></div>
                }

                if(el.type==='table'){
                  return (
                    <div key={el.id} style={{...base, alignItems:'flex-start', paddingTop:4}}>
                      <div style={{width:'100%', fontSize:11, opacity:0.85}}>
                        <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(0,0,0,0.25)', paddingBottom:4, marginBottom:4}}>
                          <b>Item</b><b>Qty</b><b>Total</b>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Sample</span><span>1</span><span>0.00</span></div>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Sample</span><span>2</span><span>0.00</span></div>
                      </div>
                    </div>
                  )
                }

                if(el.type==='totals'){
                  return (
                    <div key={el.id} style={{...base, alignItems:'flex-start', paddingTop:4}}>
                      <div style={{width:'100%', fontSize:11, opacity:0.9}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Subtotal</span><b>0.00</b></div>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Discount</span><b>0.00</b></div>
                        <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px dashed rgba(0,0,0,0.25)', marginTop:4, paddingTop:4}}><span>Grand</span><b>0.00</b></div>
                      </div>
                    </div>
                  )
                }

                if(el.type==='qr' || el.type==='barcode'){
                  return (
                    <div key={el.id} style={{...base, alignItems:'center', justifyContent:'center'}}>
                      <div style={{width: Math.min(el.w, el.h), height: Math.min(el.w, el.h), border:'1px solid rgba(0,0,0,0.35)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, opacity:0.7}}>
                        {el.type.toUpperCase()}
                      </div>
                    </div>
                  )
                }

                if(el.type==='logo'){
                  return (
                    <div key={el.id} style={{...base, alignItems:'center', justifyContent:'center'}}>
                      <div style={{width:'100%', height:'100%', border:'1px dashed rgba(0,0,0,0.25)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, opacity:0.7}}>
                        LOGO
                      </div>
                    </div>
                  )
                }

                // text
                return (
                  <div key={el.id} style={base}>
                    <span style={{whiteSpace:'pre-wrap'}}>{el.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PrintDesignerPage() {
  const { activeBranchId } = useAuth()
  const toast = useToast()
  const { t } = useI18n()

  const [step, setStep] = useState(1)

  const [docType, setDocType] = useState('sale')
  const [paper, setPaper] = useState('80')
  const [orientation, setOrientation] = useState('portrait')
  const [name, setName] = useState('Receipt')

  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  const [elements, setElements] = useState([newEl()])
  const [selectedId, setSelectedId] = useState(null)

  const [importText, setImportText] = useState('')

  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const resizeRef = useRef(null)

  const dims = useMemo(() => paperDims(paper, orientation), [paper, orientation])

  const selected = useMemo(() => elements.find(e => e.id === selectedId) || null, [elements, selectedId])

  const tokens = useMemo(() => ([
    '{{list_ref}}',
    '{{date}}',
    '{{cashier}}',
    '{{customer}}',
    '{{branch_name}}',
    '{{subtotal}}',
    '{{discount}}',
    '{{grand_total}}',
  ]), [])

  const schema = useMemo(() => ({
    meta: { doc_type: docType, paper_size: paper, orientation, name },
    elements,
  }), [docType, paper, orientation, name, elements])

  async function loadTemplates() {
    if (!activeBranchId) return
    const r = await supabase
      .from('print_templates')
      .select('id,name,doc_type,paper_size,orientation,template_json,is_default,created_at')
      .eq('branch_id', activeBranchId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (r.error) {
      toast.show({ titleAr: 'خطأ', titleEn: 'Error', ar: r.error.message, en: r.error.message })
      return
    }
    setTemplates(r.data || [])
  }

  useEffect(() => { loadTemplates() }, [activeBranchId])

  function addElement() {
    const el = newEl({ x: 10, y: 10, text: 'Text' })
    setElements(prev => [el, ...prev])
    setSelectedId(el.id)
  }

  function addToken(tok) {
    const el = newEl({ text: tok, w: 220, h: 34 })
    setElements(prev => [el, ...prev])
    setSelectedId(el.id)
  }

  function updateSelected(patch) {
    if (!selected) return
    setElements(prev => prev.map(e => e.id === selected.id ? { ...e, ...patch } : e))
  }

  function removeSelected() {
    if (!selected) return
    setElements(prev => prev.filter(e => e.id !== selected.id))
    setSelectedId(null)
  }

  function snap(n, grid = 5) {
    return Math.round(n / grid) * grid
  }

  function onMouseMove(e) {
    if (dragRef.current) {
      const { id, startX, startY, baseX, baseY } = dragRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      setElements(prev => prev.map(el => {
        if (el.id !== id) return el
        const nx = snap(Math.max(0, baseX - dx), 5) // RTL canvas: right-based
        const ny = snap(Math.max(0, baseY + dy), 5)
        return { ...el, x: nx, y: ny }
      }))
      return
    }

    if (resizeRef.current) {
      const { id, startX, startY, baseW, baseH } = resizeRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      setElements(prev => prev.map(el => {
        if (el.id !== id) return el
        const nw = snap(Math.max(40, baseW + dx), 5)
        const nh = snap(Math.max(20, baseH + dy), 5)
        return { ...el, w: nw, h: nh }
      }))
    }
  }

  function onMouseUp() {
    dragRef.current = null
    resizeRef.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function dragStart(e, el) {
    e.preventDefault()
    dragRef.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: el.x,
      baseY: el.y,
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function resizeStart(e, el) {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      baseW: el.w,
      baseH: el.h,
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  async function save() {
    if (!activeBranchId) return
    const payload = {
      branch_id: activeBranchId,
      name: name || 'Template',
      doc_type: docType,
      paper_size: paper,
      orientation,
      template_json: schema,
      is_default: false,
    }

    // If loading an existing template, update it; otherwise insert new
    let r
    if (selectedTemplateId) {
      r = await supabase.from('print_templates').update(payload).eq('id', selectedTemplateId)
    } else {
      r = await supabase.from('print_templates').insert(payload)
    }

    if (r.error) {
      toast.show({ titleAr: 'خطأ', titleEn: 'Error', ar: r.error.message, en: r.error.message })
      return
    }

    toast.show({ titleAr: 'تم', titleEn: 'OK', ar: 'تم حفظ القالب', en: 'Template saved' })
    setStep(1)
    setSelectedTemplateId('')
    loadTemplates()
  }

  function exportJson() {
    const txt = JSON.stringify(schema, null, 2)
    setImportText(txt)
    // try clipboard
    try {
      navigator.clipboard?.writeText(txt)
    } catch (_) { }
    toast.show({ titleAr: 'تم', titleEn: 'OK', ar: 'تم تجهيز JSON في مربع الاستيراد', en: 'JSON prepared in import box' })
  }

  function importJson() {
    try {
      const obj = JSON.parse(importText || '{}')
      const els = obj?.elements || obj?.template_json?.elements || obj?.schema?.elements
      if (!Array.isArray(els) || !els.length) {
        toast.show({ titleAr: 'تعذر', titleEn: 'Invalid', ar: 'JSON لا يحتوي elements', en: 'JSON missing elements' })
        return
      }
      setElements(els)
      setSelectedId(els[0]?.id || null)
      toast.show({ titleAr: 'تم', titleEn: 'OK', ar: 'تم الاستيراد', en: 'Imported' })
    } catch (e) {
      toast.show({ titleAr: 'تعذر', titleEn: 'Invalid', ar: String(e.message || e), en: String(e.message || e) })
    }
  }

  function loadTemplateIntoDesigner(id) {
    const tpl = templates.find(x => x.id === id)
    if (!tpl) return
    const sch = tpl.template_json || {}
    const els = sch.elements || []
    setSelectedTemplateId(tpl.id)
    setDocType(tpl.doc_type || 'sale')
    setPaper(tpl.paper_size || '80')
    setOrientation(tpl.orientation || 'portrait')
    setName(tpl.name || 'Template')
    if (Array.isArray(els) && els.length) {
      setElements(els)
      setSelectedId(els[0]?.id || null)
    } else {
      setElements([newEl()])
      setSelectedId(null)
    }
    setStep(2)
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="card">
        <div className="cardHeader row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 900 }}>Print Designer</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setStep(1)}>1</button>
            <button className="btn" onClick={() => setStep(2)}>2</button>
            <button className="btn" onClick={() => setStep(3)}>3</button>
            <button className="btn" onClick={() => setStep(4)}>4</button>
          </div>
        </div>

        <div className="cardBody">
          {step === 1 && (
            <div className="col" style={{ gap: 10 }}>
              <div className="grid grid2">
                <div>
                  <div className="label">Document type</div>
                  <select className="select" value={docType} onChange={e => setDocType(e.target.value)} style={{ width: '100%' }}>
                    <option value="sale">sale</option>
                    <option value="purchase">purchase</option>
                    <option value="report">report</option>
                    <option value="return_sale">return_sale</option>
                    <option value="return_purchase">return_purchase</option>
                  </select>
                </div>

                <div>
                  <div className="label">Paper</div>
                  <select className="select" value={paper} onChange={e => setPaper(e.target.value)} style={{ width: '100%' }}>
                    <option value="58">58</option>
                    <option value="80">80</option>
                    <option value="A4">A4</option>
                  </select>
                </div>

                <div>
                  <div className="label">Orientation</div>
                  <select className="select" value={orientation} onChange={e => setOrientation(e.target.value)} style={{ width: '100%' }}>
                    <option value="portrait">portrait</option>
                    <option value="landscape">landscape</option>
                  </select>
                </div>

                <div>
                  <div className="label">Template name</div>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} />
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btnPrimary" onClick={() => setStep(2)}>Next</button>
                <button className="btn" onClick={loadTemplates}>Refresh templates</button>
              </div>

              <div className="card" style={{ marginTop: 10 }}>
                <div className="cardHeader">Existing templates</div>
                <div className="cardBody" style={{ maxHeight: 360, overflow: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Paper</th>
                        <th>Orientation</th>
                        <th style={{ width: 120 }}>{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(templates || []).map(tp => (
                        <tr key={tp.id}>
                          <td><b>{tp.name}</b></td>
                          <td className="hint">{tp.doc_type}</td>
                          <td className="hint">{tp.paper_size}</td>
                          <td className="hint">{tp.orientation}</td>
                          <td>
                            <button className="btn" onClick={() => loadTemplateIntoDesigner(tp.id)}>Load</button>
                          </td>
                        </tr>
                      ))}
                      {!templates?.length && <tr><td colSpan={5} className="hint">No templates.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid2" style={{ alignItems: 'start' }}>
              <div className="card">
                <div className="cardHeader row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 900 }}>Canvas</div>
                  <div className="col" style={{ alignItems: "flex-end", gap: 8 }}>
                    <button className="btn" onClick={addElement}>+ Element</button>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span className="hint">Tokens:</span>
                      {tokens.map(tok => (
                        <button key={tok} className="btn" onClick={() => addToken(tok)}>{tok}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="cardBody">
                  <div
                    ref={canvasRef}
                    style={{
                      position: 'relative',
                      width: dims.w,
                      height: dims.h,
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
                      backgroundSize: '10px 10px',
                    }}
                  >
                    {elements.map(el => (
                      <div
                        key={el.id}
                        className={'el ' + (selectedId === el.id ? 'elSelected' : '')}
                        style={{
                          position: 'absolute',
                          right: el.x,          // RTL positioning
                          top: el.y,
                          width: el.w,
                          height: el.h,
                          border: selectedId === el.id ? '2px solid rgba(0,255,180,0.6)' : '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 10,
                          padding: 6,
                          cursor: 'move',
                          background: 'rgba(0,0,0,0.18)',
                          userSelect: 'none',
                          textAlign: el.align,
                        }}
                        onMouseDown={(e) => { setSelectedId(el.id); dragStart(e, el) }}
                      >
                        <div style={{ fontWeight: el.bold ? 900 : 600, fontSize: el.fontSize }}>
                          {el.type === 'text' ? el.text : el.type.toUpperCase()}
                        </div>

                        {selectedId === el.id && (
                          <div
                            onMouseDown={(e) => resizeStart(e, el)}
                            style={{
                              position: 'absolute',
                              right: 6,
                              bottom: 6,
                              width: 12,
                              height: 12,
                              borderRadius: 4,
                              background: 'rgba(0,255,180,0.7)',
                              cursor: 'nwse-resize'
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="row" style={{ gap: 10, marginTop: 10 }}>
                    <button className="btn" onClick={() => setStep(1)}>Back</button>
                    <button className="btn btnPrimary" onClick={() => setStep(3)}>Next</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="cardHeader">Properties</div>
                <div className="cardBody">
                  {!selected && <div className="hint">Select an element</div>}

                  {selected && (
                    <div className="col" style={{ gap: 10 }}>
                      <div>
                        <div className="label">Type</div>
                        <select className="select" value={selected.type} onChange={e => updateSelected({ type: e.target.value })} style={{ width: '100%' }}>
                          <option value="text">text</option>
                          <option value="line">line</option>
                          <option value="table">table</option>
                          <option value="totals">totals</option>
                          <option value="qr">qr</option>
                          <option value="barcode">barcode</option>
                          <option value="logo">logo</option>
                        </select>
                      </div>

                      {selected.type === 'text' && (
                        <div>
                          <div className="label">Text</div>
                          <textarea className="textarea" value={selected.text} onChange={e => updateSelected({ text: e.target.value })} />
                        </div>
                      )}

                      <div className="grid grid2">
                        <div>
                          <div className="label">X (right)</div>
                          <input className="input" value={selected.x} onChange={e => updateSelected({ x: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <div className="label">Y</div>
                          <input className="input" value={selected.y} onChange={e => updateSelected({ y: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <div className="label">W</div>
                          <input className="input" value={selected.w} onChange={e => updateSelected({ w: Number(e.target.value || 0) })} />
                        </div>
                        <div>
                          <div className="label">H</div>
                          <input className="input" value={selected.h} onChange={e => updateSelected({ h: Number(e.target.value || 0) })} />
                        </div>
                      </div>

                      <div className="grid grid2">
                        <div>
                          <div className="label">Align</div>
                          <select className="select" value={selected.align} onChange={e => updateSelected({ align: e.target.value })} style={{ width: '100%' }}>
                            <option value="left">left</option>
                            <option value="center">center</option>
                            <option value="right">right</option>
                          </select>
                        </div>
                        <div>
                          <div className="label">Font size</div>
                          <input className="input" value={selected.fontSize} onChange={e => updateSelected({ fontSize: Number(e.target.value || 14) })} />
                        </div>
                      </div>

                      <div className="row" style={{ gap: 10 }}>
                        <button className="btn" onClick={() => updateSelected({ bold: !selected.bold })}>
                          {selected.bold ? 'Unbold' : 'Bold'}
                        </button>
                        <button className="btn btnDanger" onClick={removeSelected}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {step === 3 && (
            <div className="col" style={{ gap: 10 }}>
              <div className="hint">Preview uses paper size + orientation + margin (dashed safe-area). No rotation bugs.</div>

              <PreviewRender
                dims={dims}
                paper={paper}
                elements={elements}
                title={name}
                subtitle={`doc: ${docType} • paper: ${paper} • ${orientation}`}
              />

              <div className="row" style={{ gap: 10 }}>
                <button className="btn" onClick={() => setStep(2)}>Back</button>
                <button className="btn btnPrimary" onClick={() => setStep(4)}>Next</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="col">
              <div className="hint">
                Save will store template in DB table: print_templates (branch scoped).
              </div>

              <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <button className="btn btnPrimary" onClick={save}>Save to DB</button>
                <button className="btn" onClick={exportJson}>Export JSON</button>
                <button className="btn" onClick={() => setStep(3)}>Back</button>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="label">Import JSON</div>
                <textarea
                  className="textarea"
                  style={{ minHeight: 160 }}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder='Paste template JSON here (must contain "elements")'
                />
                <div className="row" style={{ gap: 10, marginTop: 10 }}>
                  <button className="btn btnPrimary" onClick={importJson}>Import</button>
                  <button className="btn" onClick={() => setImportText(JSON.stringify(schema, null, 2))}>
                    Copy current JSON
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
