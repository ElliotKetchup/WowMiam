export const Alert = { alert: (...a: unknown[]) => console.log('ALERT', JSON.stringify(a.slice(0, 2))) };
