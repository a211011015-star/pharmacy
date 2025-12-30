export function getHashPath(){const h=window.location.hash||'#/dashboard';const p=h.replace('#','');return p.startsWith('/')?p:'/dashboard'}
export function nav(path){window.location.hash='#'+(path.startsWith('/')?path:path.replace('#',''))}
