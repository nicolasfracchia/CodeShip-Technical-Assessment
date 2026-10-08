export const uid = () => Math.random().toString(36).slice(2);
export const fmtCost = (n: number) => (n === 0 ? "$0" : n < 0.0001 ? "<$0.0001" : `$${n.toFixed(4)}`);
export const fmtInt = (n: number) => n.toLocaleString("en-US");
