import React from 'react'
export function Modal({open,title,children,onClose}){
  if(!open) return null
  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="card modal" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="cardHeader row" style={{justifyContent:'space-between'}}>
          <div style={{fontWeight:900}}>{title}</div>
          <button className="btn" onClick={onClose}>×</button>
        </div>
        <div className="cardBody">{children}</div>
      </div>
    </div>
  )
}
