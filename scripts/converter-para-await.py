#!/usr/bin/env python3
"""
Converte as chamadas de banco síncronas para assíncronas.

O app foi escrito sobre o better-sqlite3, que devolve a linha na hora.
Com Postgres cada chamada vira uma promessa, e a conversão tem uma
armadilha que não lança erro nenhum:

    db.prepare(sql).get().total      -> await (promessa.total)  -> undefined
    db.prepare(sql).get()?.sql       -> await (promessa?.sql)   -> undefined

Porque `.` liga mais forte que `await`. Quando a chamada é seguida de
acesso a campo, os parênteses são obrigatórios:

    (await db.prepare(sql).get()).total

Este script acha o fim exato de cada chamada contando parênteses — não
por expressão regular, que erraria em SQL com parêntese dentro — e
decide entre `await X` e `(await X)` olhando o que vem depois.
"""

import re
import sys

METODOS = ('get', 'all', 'run', 'pluck', 'iterate')


def fim_da_chamada(texto, inicio_parenteses):
    """Devolve o índice logo após o ')' que fecha, ignorando strings."""
    nivel = 0
    i = inicio_parenteses
    aspas = None
    while i < len(texto):
        c = texto[i]
        if aspas:
            if c == '\\':
                i += 2
                continue
            if c == aspas:
                aspas = None
        elif c in ('"', "'", '`'):
            aspas = c
        elif c == '(':
            nivel += 1
        elif c == ')':
            nivel -= 1
            if nivel == 0:
                return i + 1
        i += 1
    return -1


def converter(texto, nome_objeto='db'):
    """Insere `await` em cada db.prepare(...).get|all|run(...)."""
    saida = texto
    alvo = f'{nome_objeto}.prepare('
    posicao = 0
    inseridos = 0
    com_parenteses = 0

    while True:
        i = saida.find(alvo, posicao)
        if i == -1:
            break

        fim_prepare = fim_da_chamada(saida, i + len(alvo) - 1)
        if fim_prepare == -1:
            posicao = i + 1
            continue

        # Depois do prepare(...) pode haver quebra de linha antes do .get(
        j = fim_prepare
        while j < len(saida) and saida[j] in ' \t\n\r':
            j += 1

        if j >= len(saida) or saida[j] != '.':
            # prepare() sozinho, guardado numa variável: não é chamada.
            posicao = fim_prepare
            continue

        metodo = re.match(r'\.(\w+)\s*\(', saida[j:])
        if not metodo or metodo.group(1) not in METODOS:
            posicao = fim_prepare
            continue

        fim_metodo = fim_da_chamada(saida, j + metodo.end() - 1)
        if fim_metodo == -1:
            posicao = fim_prepare
            continue

        # Já convertido?
        antes = saida[:i].rstrip()
        if antes.endswith('await'):
            posicao = fim_metodo
            continue

        # O que vem depois decide se os parênteses são obrigatórios.
        k = fim_metodo
        while k < len(saida) and saida[k] in ' \t\n\r':
            k += 1
        precisa_parenteses = k < len(saida) and (
            saida[k] == '.' or saida[k:k + 2] == '?.'
        )

        expressao = saida[i:fim_metodo]
        if precisa_parenteses:
            novo = f'(await {expressao})'
            com_parenteses += 1
        else:
            novo = f'await {expressao}'

        saida = saida[:i] + novo + saida[fim_metodo:]
        inseridos += 1
        posicao = i + len(novo)

    return saida, inseridos, com_parenteses


def tornar_handlers_assincronos(texto):
    """router.get('/x', meio, (req, res) => {  ->  async (req, res) => {"""
    padrao = re.compile(r'(router\.(?:get|post|put|delete|patch)\([^;]*?,\s*)(\(req, res\)\s*=>)')
    return padrao.sub(lambda m: m.group(1) + 'async ' + m.group(2), texto)


def transacoes_assincronas(texto):
    """
    db.transaction(() => {...}) -> db.transaction(async () => {...})
    e `criar();` -> `await criar();` para a função que ela devolve.

    Sem isto, um `await` dentro do bloco é erro de sintaxe, e a
    transação terminaria antes das consultas — confirmando um COMMIT
    de nada.
    """
    texto = re.sub(r'db\.transaction\(\s*\(', 'db.transaction(async (', texto)
    texto = re.sub(r'db\.transaction\(async \(async \(', 'db.transaction(async (', texto)

    nomes = re.findall(r'const (\w+) = db\.transaction\(', texto)
    for nome in nomes:
        # Chamada isolada da transação, em início de instrução.
        texto = re.sub(
            r'(?<![.\w])(?<!await )\b' + nome + r'\(\)',
            'await ' + nome + '()',
            texto,
        )
        texto = re.sub(
            r'(?<![.\w])(?<!await )\b' + nome + r'\((?!\))',
            'await ' + nome + '(',
            texto,
        )
    # Não duplicar await onde a declaração usa o mesmo nome.
    texto = texto.replace('const await ', 'const ')
    return texto


def main():
    caminho = sys.argv[1]
    with open(caminho, encoding='utf-8') as f:
        original = f.read()

    texto, n, p = converter(original, 'db')
    texto = re.sub(r'(?<!await )\bdb\.exec\(', 'await db.exec(', texto)
    texto = transacoes_assincronas(texto)
    antes_handlers = texto.count('async (req, res)')
    texto = tornar_handlers_assincronos(texto)
    handlers = texto.count('async (req, res)') - antes_handlers

    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(texto)

    print(f'{caminho}: {n} chamadas ({p} com parênteses obrigatórios), {handlers} handlers')


if __name__ == '__main__':
    main()
