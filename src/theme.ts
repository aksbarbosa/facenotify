export const PRIMARY   = '#5C6BC0'; // indigo suave — tom único do app
export const BG        = '#F2F4FB'; // fundo geral
export const CARD      = '#FFFFFF';
export const TEXT      = '#111827';
export const TEXT2     = '#6B7280';
export const TEXT3     = '#9CA3AF';
export const BORDER    = '#F3F4F6';
export const DANGER    = '#DC2626';

// Avatar: cada pessoa tem uma cor derivada da inicial, dentro da paleta do app
const PALETTE = [
  '#5C6BC0', // indigo
  '#26A69A', // teal
  '#EF5350', // vermelho
  '#AB47BC', // roxo
  '#FF7043', // laranja
  '#42A5F5', // azul claro
];
export function avatarColor(name: string): string {
  return PALETTE[name.charCodeAt(0) % PALETTE.length];
}
