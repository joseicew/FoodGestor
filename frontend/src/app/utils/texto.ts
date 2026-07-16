/**
 * Normaliza texto para comparaciones de busqueda: minusculas y sin tildes/diacriticos.
 * Usar en todos los buscadores para que "Jamon" == "jamon" == "JAMON" == "Jamón".
 */
export function normalizarTexto(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
