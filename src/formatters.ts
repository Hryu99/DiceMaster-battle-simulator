export const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits })

export const formatPercent = (value: number) => `${formatNumber(value * 100, 1)}%`
