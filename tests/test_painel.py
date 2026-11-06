"""Testes das funções puras do Painel de Suporte (rodam em qualquer sistema, sem Windows nem Tkinter)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import painel_suporte as p  # noqa: E402


RESPOSTAS = [
    {"atalho": "senha", "titulo": "Recuperar senha", "categoria": "Conta",
     "palavras_chave": ["esqueci", "login"], "resposta": "Clique em **Esqueci minha senha**."},
    {"atalho": "pagamento", "titulo": "Pagamento pendente", "categoria": "Pagamentos",
     "palavras_chave": ["pix", "cobranca"], "resposta": "Seu pagamento está em análise."},
]


def test_remover_acentos():
    assert p.remover_acentos("  Ação ÇÃO ") == "acao cao"
    assert p.remover_acentos("") == ""


def test_anonimizar_troca_email_e_numero_longo_e_reaproveita_marcador():
    texto = "Meu email é a@b.com, de novo a@b.com e o CPF 12345678901."
    limpo, mapa = p.anonimizar(texto)
    assert "a@b.com" not in limpo and "12345678901" not in limpo
    assert limpo.count("[EMAIL_1]") == 2
    assert sorted(mapa.values()) == ["12345678901", "a@b.com"]


def test_anonimizar_nao_mexe_em_numero_curto():
    limpo, mapa = p.anonimizar("Ticket 123456")
    assert limpo == "Ticket 123456" and mapa == {}


def test_texto_para_html_negrito_paragrafos_e_escape():
    html = p.texto_para_html("Olá **mundo**\n\n\n<b>x</b>")
    assert html == "<p>Olá <strong>mundo</strong></p><p></p><p>&lt;b&gt;x&lt;/b&gt;</p>"


def test_texto_sem_marcacao():
    assert p.texto_sem_marcacao("a **b** c") == "a b c"


def test_buscar_atalhos_prioriza_atalho_exato_e_ignora_acento():
    achados = p.buscar_atalhos(RESPOSTAS, "SENHA")
    assert [r["atalho"] for r in achados] == ["senha"]
    assert p.buscar_atalhos(RESPOSTAS, "cobrança")[0]["atalho"] == "pagamento"
    assert p.buscar_atalhos(RESPOSTAS, "") == []


def test_filtrar_respostas_por_categoria_e_termo():
    assert len(p.filtrar_respostas(RESPOSTAS, "", "Todas")) == 2
    assert [r["atalho"] for r in p.filtrar_respostas(RESPOSTAS, "", "Conta")] == ["senha"]
    assert [r["atalho"] for r in p.filtrar_respostas(RESPOSTAS, "analise")] == ["pagamento"]


def test_parece_bug():
    assert p.parece_bug("O jogo TRAVOU quando abri o mapa")
    assert p.parece_bug("não está funcionando o login")
    assert not p.parece_bug("Quero mudar meu e-mail de cadastro")


def test_extrair_reporte_de_trecho_simples():
    dados = p.extrair_reporte("O boss não aparece mais.")
    assert dados["mensagem"] == "O boss não aparece mais."
    assert dados["ticket"] == ""


def test_extrair_reporte_pega_numero_do_ticket():
    dados = p.extrair_reporte("TICKET #123456\nMENSAGEM ORIGINAL\nHeroi\n01/02/2030, 10:30\nO boss sumiu.\nRESPONDER")
    assert dados["ticket"] == "123456"
    assert dados["jogador"] == "Heroi"
    assert dados["mensagem"] == "O boss sumiu."


def test_montar_reporte():
    out = p.montar_reporte({"ticket": "99999", "jogador": "Ana"}, " texto ")
    assert out == "Ticket: 99999\nJogador: Ana\n\ntexto"


def test_respostas_padrao_tem_campos_obrigatorios_e_atalhos_unicos():
    atalhos = []
    for r in p.RESPOSTAS_PADRAO:
        for campo in ("atalho", "titulo", "categoria", "palavras_chave", "resposta"):
            assert r.get(campo), f"{r.get('atalho')} sem {campo}"
        atalhos.append(r["atalho"])
    assert len(atalhos) == len(set(atalhos)), "atalhos duplicados"
