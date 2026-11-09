# Identidade visual Gerencial

O aplicativo utiliza os arquivos originais da Gerencial, sem redesenho:

- `gerencial-logo.png`: logotipo horizontal oficial.
- `gerencial-simbolo.png`: símbolo oficial.

Para evitar imagens quebradas quando o projeto for publicado, cópias dos arquivos originais estão incorporadas em `src/lib/brand-assets.ts`. O site serve essas cópias pelas rotas `/identidade/logo.png` e `/identidade/simbolo.png`. O favicon `/favicon.ico` usa o símbolo original redimensionado para 16, 32, 48 e 64 pixels.

Se a marca oficial for atualizada, atualize os PNGs e regenere o arquivo incorporado e o favicon; trocar apenas os PNGs nesta pasta não altera as cópias incorporadas.

## Identidade visual

- Azul-marinho: `#181447`.
- Ouro: `#FAB12A`.
- Verde de apoio: `#0E4828`.
- Tipografia da interface: Arial.

O logo horizontal tem letras brancas e deve ser exibido sobre o fundo azul-marinho institucional.
