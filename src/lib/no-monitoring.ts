/** Identifica a oferta de NOC/monitoramento sem confundir com CFTV com imagem noturna ou central de alarme. */
export function isUnsupportedMonitoringOffer(value: string): boolean {
  return /\bmonitoramento\b|\bmonitoring\b|\bNOC\b|\bronda virtual\b/i.test(value);
}
