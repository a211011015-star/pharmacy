export function money(n,c='IQD'){const v=Number(n||0);return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v)+' '+c}
