import { supabase } from '../lib/supabase'

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function fmt2(n) {
  const x = Number(n || 0)
  return x.toFixed(2)
}

function replaceTokens(text, data) {
  let s = String(text ?? '')
  const map = {
    '{{list_ref}}': data.list_ref,
    '{{date}}': data.date,
    '{{cashier}}': data.cashier,
    '{{customer}}': data.customer,
    '{{branch_name}}': data.branch_name,
    '{{subtotal}}': fmt2(data.subtotal),
    '{{discount}}': fmt2(data.discount),
    '{{grand_total}}': fmt2(data.grand_total),
  }
  for (const k of Object.keys(map)) {
    s = s.split(k).join(String(map[k] ?? ''))
  }
  return s
}

function defaultSaleTemplate(paper = '80') {
  // Simple but robust fallback template
  const w = paper === '58' ? 280 : 380
  return {
    meta: { doc_type: 'sale', paper_size: paper, orientation: 'portrait', name: 'Default Sale' },
    elements: [
      { id: 't1', type: 'text', text: '{{branch_name}}', x: 10, y: 8, w: w - 20, h: 30, align: 'center', fontSize: 16, bold: true },
      { id: 't2', type: 'text', text: '{{date}}', x: 10, y: 34, w: w - 20, h: 22, align: 'center', fontSize: 12, bold: false },
      { id: 'line1', type: 'line', x: 10, y: 62, w: w - 20, h: 2 },
      { id: 'table', type: 'table', x: 10, y: 70, w: w - 20, h: 380 },
      { id: 'tot', type: 'totals', x: 10, y: 460, w: w - 20, h: 120 },
      { id: 'bc', type: 'barcode', x: 10, y: 585, w: w - 20, h: 60, align: 'center', fontSize: 12, bold: false },
    ],
  }
}

function paperCss(paper, orientation, marginMm = 4) {
  const mm = Number(marginMm || 0)
  if (paper === 'A4') {
    const size = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'
    return `@page{size:${size};margin:${mm}mm;}`
  }
  const width = paper === '58' ? 58 : 80
  // height auto is allowed on most printers; use a large height.
  return `@page{size:${width}mm 300mm;margin:${mm}mm;}`
}

function renderElement(el, data) {
  const x = Number(el.x || 0)
  const y = Number(el.y || 0)
  const w = Number(el.w || 0)
  const h = Number(el.h || 0)
  const align = el.align || 'left'
  const fs = Number(el.fontSize || 12)
  const fw = el.bold ? 700 : 400

  const baseStyle = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;font-size:${fs}px;font-weight:${fw};text-align:${align};overflow:hidden;white-space:pre-wrap;`

  if (el.type === 'line') {
    return `<div style="${baseStyle}border-top:1px solid rgba(0,0,0,0.65);"></div>`
  }

  if (el.type === 'table') {
    const rows = (data.items || []).map((it) => {
      const name = escapeHtml(it.name)
      const qty = escapeHtml(String(it.qty))
      const total = escapeHtml(fmt2(it.total))
      return `<tr><td style="padding:2px 0;">${name}</td><td style="width:52px;text-align:center;">${qty}</td><td style="width:70px;text-align:right;">${total}</td></tr>`
    }).join('')

    return `
      <div style="${baseStyle}">
        <table style="width:100%;border-collapse:collapse;font-size:${fs}px;">
          <thead>
            <tr>
              <th style="text-align:left;font-weight:700;padding:2px 0;">Item</th>
              <th style="width:52px;text-align:center;font-weight:700;padding:2px 0;">Qty</th>
              <th style="width:70px;text-align:right;font-weight:700;padding:2px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `
  }

  if (el.type === 'totals') {
    return `
      <div style="${baseStyle}">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Subtotal</span><span>${escapeHtml(fmt2(data.subtotal))}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Discount</span><span>${escapeHtml(fmt2(data.discount))}</span></div>
        <div style="border-top:1px solid rgba(0,0,0,0.65);margin:4px 0;"></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;font-weight:900;"><span>Total</span><span>${escapeHtml(fmt2(data.grand_total))}</span></div>
      </div>
    `
  }

  if (el.type === 'barcode' || el.type === 'qr') {
    const txt = replaceTokens(el.text || '{{list_ref}}', data)
    return `
      <div style="${baseStyle}display:flex;align-items:center;justify-content:center;border:1px dashed rgba(0,0,0,0.45);border-radius:8px;">
        <div>${escapeHtml(txt)}</div>
      </div>
    `
  }

  // default: text
  const txt = replaceTokens(el.text, data)
  return `<div style="${baseStyle}">${escapeHtml(txt)}</div>`
}

function openPrintWindow(html) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) throw new Error('Popup blocked')
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  // Print after styles applied
  setTimeout(() => {
    try { w.print() } catch { /* ignore */ }
  }, 50)
}

async function getBranchName(branchId) {
  const r = await supabase.from('branches').select('name_ar,name_en').eq('id', branchId).single()
  if (r.error) return 'Branch'
  return r.data?.name_ar || r.data?.name_en || 'Branch'
}

async function loadTemplate(branchId, docType = 'sale', paper = '80') {
  const r = await supabase
    .from('print_templates')
    .select('id,template_json,orientation,paper_size,doc_type')
    .eq('branch_id', branchId)
    .eq('doc_type', docType)
    .eq('paper_size', paper)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (!r.error && r.data && r.data[0]?.template_json?.elements) {
    return r.data[0].template_json
  }
  return defaultSaleTemplate(paper)
}

export async function printSaleReceipt({ branchId, saleId, paper = '80', marginMm = 4 }) {
  if (!branchId || !saleId) throw new Error('Missing branchId/saleId')

  const [branchName, tpl] = await Promise.all([
    getBranchName(branchId),
    loadTemplate(branchId, 'sale', paper),
  ])

  const rSale = await supabase
    .from('sales')
    .select('id,branch_id,list_ref,created_at,customer_name,subtotal,grand_total,discount_value,discount_type')
    .eq('id', saleId)
    .single()

  if (rSale.error) throw new Error(rSale.error.message)

  const rItems = await supabase
    .from('sale_items')
    .select('id,qty,unit_price,line_total,products(trade_name_en,trade_name_ar,strength,dosage_form)')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })

  if (rItems.error) throw new Error(rItems.error.message)

  const items = (rItems.data || []).map((x) => {
    const p = x.products || {}
    const name = [p.trade_name_en, p.strength].filter(Boolean).join(' ')
    return { name, qty: x.qty, total: x.line_total }
  })

  const discount = rSale.data.discount_type === 'percent'
    ? (Number(rSale.data.subtotal || 0) * (Number(rSale.data.discount_value || 0) / 100.0))
    : Number(rSale.data.discount_value || 0)

  const data = {
    branch_name: branchName,
    list_ref: rSale.data.list_ref,
    date: new Date(rSale.data.created_at).toLocaleString(),
    cashier: '',
    customer: rSale.data.customer_name || '',
    subtotal: rSale.data.subtotal,
    discount,
    grand_total: rSale.data.grand_total,
    items,
  }

  const elements = Array.isArray(tpl.elements) ? tpl.elements : []
  const paperSize = tpl.meta?.paper_size || paper
  const orientation = tpl.meta?.orientation || 'portrait'

  // Compute a reasonable canvas size for thermal: 58 => 280px, 80 => 380px
  const canvasW = (paperSize === '58') ? 280 : (paperSize === '80' ? 380 : 595)
  const canvasH = (paperSize === 'A4') ? 842 : 900

  const body = elements.map((el) => renderElement(el, data)).join('')

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt</title>
<style>
${paperCss(paperSize, orientation, marginMm)}
html,body{padding:0;margin:0;}
body{font-family: Arial, sans-serif;color:#000;}
#paper{position:relative;width:${canvasW}px;min-height:${canvasH}px;}
</style>
</head>
<body>
  <div id="paper">${body}</div>
</body>
</html>`

  openPrintWindow(html)
}
