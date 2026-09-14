#!/usr/bin/env bash
# ============================================================
# RUSH RUNNING — Regenera as fontes hospedadas em public/fonts
# ------------------------------------------------------------
# O app não depende do CDN do Google: as fontes vivem em
# public/fonts. A fonte de ícones é um SUBCONJUNTO — contém
# apenas os ícones que o código usa hoje (83 KB em vez dos
# 3,8 MB da fonte completa).
#
# RODE ESTE SCRIPT sempre que usar um ícone novo do Material
# Symbols. Sem isso o ícone não existe na fonte e o guarda de
# carregamento o mantém invisível — o layout não quebra, mas o
# ícone não aparece.
#
#   bash scripts/atualizar-fontes.sh
#
# Requer: curl, python3 e acesso a fonts.googleapis.com.
# ============================================================

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAIDA="$RAIZ/public/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
SUBSETS="latin latin-ext"

mkdir -p "$SAIDA"

echo "▸ Lendo os ícones usados no código…"
# A extração precisa ser multilinha: o className costuma quebrar em várias
# linhas e o nome do ícone fica sozinho numa linha seguinte. Um grep de
# linha única perde esses casos silenciosamente — e um ícone que falta na
# fonte aparece na tela como o nome da ligadura em texto cru.
RAIZ="$RAIZ" TMP="$TMP" python3 "$RAIZ/scripts/listar-icones.py" > "$TMP/icones.txt"
echo "  $(wc -l < "$TMP/icones.txt") ícones"

# Anton/Manrope/JetBrains Mono servem o design system novo; Inter e
# Big Shoulders Display servem o painel da assessoria (/coach), que
# continua no design system legado.
echo "▸ Baixando as famílias de texto…"
curl -sS -A "$UA" -o "$TMP/texto.css" \
  "https://fonts.googleapis.com/css2?family=Anton&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&family=Big+Shoulders+Display:ital,wght@0,600;0,700;0,800;0,900;1,700;1,800;1,900&display=swap"

echo "▸ Baixando a fonte de ícones, restrita aos ícones em uso…"
NOMES="$(paste -sd, "$TMP/icones.txt")"
curl -sS -A "$UA" -o "$TMP/icones.css" \
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=$NOMES"

SAIDA="$SAIDA" TMP="$TMP" UA="$UA" SUBSETS="$SUBSETS" python3 - <<'PY'
import io, os, re, subprocess

saida = os.environ['SAIDA']
tmp = os.environ['TMP']
ua = os.environ['UA']
manter = set(os.environ['SUBSETS'].split())

cabecalho = """/* ============================================================
   RUSH RUNNING — Fontes servidas pelo próprio app
   ------------------------------------------------------------
   ARQUIVO GERADO. Não edite à mão:
   rode scripts/atualizar-fontes.sh.

   As fontes ficam em /public/fonts para que tipografia e ícones
   não dependam de um CDN externo — sem rede, os nomes das
   ligaduras do Material Symbols apareceriam como texto cru.

   Texto: apenas os subsets latin e latin-ext.
   Ícones: apenas os ícones usados pelo código.
   ============================================================ */

"""

blocos = []

# ---- famílias de texto, um arquivo por peso e subset ----
css = io.open(f'{tmp}/texto.css', encoding='utf-8').read()
partes = re.split(r'/\*\s*([a-z0-9\-\[\]]+)\s*\*/', css)
for i in range(1, len(partes), 2):
    subset, bloco = partes[i], partes[i + 1]
    if subset not in manter:
        continue
    m = re.search(r"url\((https://fonts\.gstatic\.com[^)]+)\)", bloco)
    if not m:
        continue
    familia = re.search(r"font-family:\s*'([^']+)'", bloco).group(1)
    peso = re.search(r"font-weight:\s*([^;]+);", bloco)
    peso = peso.group(1).strip().replace(' ', '-') if peso else 'regular'
    slug = re.sub(r'[^a-z0-9]+', '-', familia.lower()).strip('-')
    nome = f'{slug}-{peso}-{subset}.woff2'
    subprocess.run(['curl', '-sS', '-A', ua, m.group(1), '-o', os.path.join(saida, nome)], check=True)
    blocos.append(bloco.replace(m.group(1), f'/fonts/{nome}').strip())

# ---- fonte de ícones, já subconjunto ----
css = io.open(f'{tmp}/icones.css', encoding='utf-8').read()
url = re.search(r"url\((https://fonts\.gstatic\.com[^)]+)\)", css).group(1)
nome = 'material-symbols-outlined.woff2'
subprocess.run(['curl', '-sS', '-A', ua, url, '-o', os.path.join(saida, nome)], check=True)
face = css.split('}')[0] + '}'
blocos.append(face.replace('/* fallback */', '').replace(url, f'/fonts/{nome}').strip())

io.open(os.path.join(saida, 'fonts.css'), 'w', encoding='utf-8').write(
    cabecalho + '\n\n'.join(blocos) + '\n'
)

total = sum(
    os.path.getsize(os.path.join(saida, f))
    for f in os.listdir(saida) if f.endswith('.woff2')
)
print(f"  {len(blocos)} @font-face · {total // 1024} KB de fontes")
PY

cp "$TMP/icones.txt" "$SAIDA/icons.txt"

echo "▸ Pronto: $SAIDA/fonts.css"
