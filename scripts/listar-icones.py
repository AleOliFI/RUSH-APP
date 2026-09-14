#!/usr/bin/env python3
"""
Lista os ícones Material Symbols usados pelo código.

Usado por scripts/atualizar-fontes.sh para gerar a fonte reduzida e pelo
teste R2.5, que falha quando o código usa um ícone que não está na fonte.

A varredura é multilinha de propósito: em JSX o className quebra em várias
linhas e o nome do ícone fica isolado, fora do alcance de um grep comum.
"""

import os
import re
import sys

RAIZ = os.environ.get('RAIZ') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# <span ... material-symbols-outlined ... > nome_do_icone </span>
PADRAO = re.compile(
    r'<span[^>]*material-symbols-outlined[^>]*>\s*([a-z0-9_]+)\s*</span>',
    re.DOTALL,
)
# Nomes escolhidos em tempo de execução: {cond ? 'lock' : 'lock_open'}
PADRAO_TERNARIO = re.compile(
    r'<span[^>]*material-symbols-outlined[^>]*>\s*\{[^}]*?\}\s*</span>',
    re.DOTALL,
)
LITERAL = re.compile(r"'([a-z0-9_]{2,40})'")

# Nomes guardados em estruturas de dados e renderizados como {item.icon}.
# Só vale em arquivos que de fato usam a fonte de ícones, para não
# arrastar qualquer campo chamado "icon" de outro contexto.
PADRAO_CAMPO_ICON = re.compile(r"\bicon:\s*'([a-z0-9_]{2,40})'")

# Nomes passados como propriedade para um componente que desenha o ícone:
# <EmptyState icone="search_off" />. Sem isto o nome vira texto na tela,
# porque a fonte reduzida não traz o glifo.
PADRAO_PROP_ICON = re.compile(
    r'\b(?:icon|icone|iconName|icon_name)\s*=\s*["\']([a-z0-9_]{2,40})["\']'
)


def main():
    icones = set()
    for pasta, _, arquivos in os.walk(os.path.join(RAIZ, 'src')):
        for arquivo in arquivos:
            if not arquivo.endswith(('.tsx', '.jsx')):
                continue
            with open(os.path.join(pasta, arquivo), encoding='utf-8') as f:
                conteudo = f.read()
            icones.update(PADRAO.findall(conteudo))
            for bloco in PADRAO_TERNARIO.findall(conteudo):
                icones.update(LITERAL.findall(bloco))
            if 'material-symbols-outlined' in conteudo:
                icones.update(PADRAO_CAMPO_ICON.findall(conteudo))
                icones.update(PADRAO_PROP_ICON.findall(conteudo))

    # Ícones que nenhuma heurística alcança (montados por concatenação,
    # vindos de dados, etc.) entram por esta lista mantida à mão.
    extras = os.path.join(RAIZ, 'scripts', 'icones-extra.txt')
    if os.path.exists(extras):
        with open(extras, encoding='utf-8') as f:
            for linha in f:
                nome = linha.split('#')[0].strip()
                if nome:
                    icones.add(nome)

    for icone in sorted(icones):
        print(icone)

    if not icones:
        print('nenhum ícone encontrado — a varredura falhou', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
