/**
 * =============================================================================
 * RENOVA SENAI - SÍNTESE DO PROFESSOR (sintese.js)
 * Consolidação Automática de Dados Acadêmicos (Frequência, Compensações, Médias)
 * Layout Moderno com Cards de Estatísticas e Tabela Aprimorada
 * =============================================================================
 */

class SinteseController {
  constructor() {
    this.turmaId = 1;
    this.ucId = 1;
  }

  init() {
    this.carregarTurmasSelect();
    this.carregarUCsSelect();
    this.renderizar();
  }

  carregarTurmasSelect() {
    const sel = document.getElementById('selectSinteseTurma');
    if (!sel) return;
    const turmas = window.db.getTurmas('EM_ANDAMENTO');
    sel.innerHTML = turmas.map(t => `<option value="${t.id}">${t.codigo} - ${t.nome}</option>`).join('');
    sel.value = this.turmaId;
  }

  carregarUCsSelect() {
    const sel = document.getElementById('selectSinteseUC');
    if (!sel) return;
    const ucs = window.db.getUCsPorTurma(this.turmaId);
    sel.innerHTML = ucs.map(u => `<option value="${u.id}">${u.codigo} - ${u.nome}</option>`).join('');
    if (ucs.length) {
      this.ucId = ucs[0].id;
      sel.value = this.ucId;
    }
  }

  onTurmaChange(novaTurmaId) {
    this.turmaId = Number(novaTurmaId);
    this.carregarUCsSelect();
    this.renderizar();
  }

  onUCChange(novaUCId) {
    this.ucId = Number(novaUCId);
    this.renderizar();
  }

  renderizar() {
    const tbody = document.getElementById('sinteseTableBody');
    const headerInfo = document.getElementById('sinteseHeaderInfo');
    const resumoContainer = document.getElementById('sinteseResumoCards');
    const legendaContainer = document.getElementById('sinteseLegenda');
    if (!tbody) return;

    const dados = window.db.getSinteseConsolidada(this.turmaId, this.ucId);
    const turma = window.db.getTurmaById(this.turmaId);
    const uc = window.db.getUCById(this.ucId);
    const alunosAtivos = dados.alunos.filter(item => 
      item.aluno.statusMatricula === 'ATIVO'
    );

    if (headerInfo && turma && uc) {
      headerInfo.innerHTML = `
        <div style="display:flex; gap:24px; flex-wrap:wrap; font-size:13.5px;">
          <div>Turma: <strong>${turma.codigo}</strong> (${turma.periodo})</div>
          <div>Unidade Curricular: <strong>${uc.nome}</strong></div>
          <div>Carga Horária Total: <strong>${uc.cargaHoraria}h</strong></div>
          <div>Aulas Ministradas até o momento: <strong>${dados.totalAulasDadas} aulas</strong></div>
        </div>
      `;
    }

    // Calcular estatísticas para cards de resumo
    const stats = this.calcularEstatisticasTurma(dados.alunos);
    this.renderizarCardsResumo(resumoContainer, stats, dados.totalAulasDadas);

    tbody.innerHTML = dados.alunos.map(item => {
      const { aluno, totalAulasDadas, presencas, faltas, atrasos, dispensas, faltasCompensadas, freqPorcentagem, media, situacaoFinal } = item;
      const ehStatusX = (aluno.statusMatricula === 'TRANCADO' || aluno.statusMatricula === 'CANCELADO');

      let situacaoClass = 'aprovado';
      let freqClass = 'good';
      if (situacaoFinal.includes('Retido por Falta')) {
        situacaoClass = 'retido-falta';
        freqClass = 'danger';
      } else if (situacaoFinal.includes('Retido por Nota')) {
        situacaoClass = 'retido-nota';
      } else if (situacaoFinal.includes('Recuperação')) {
        situacaoClass = 'recuperacao';
        freqClass = freqPorcentagem >= 75 ? 'good' : 'warning';
      } else if (situacaoFinal.includes('Trancada')) {
        situacaoClass = 'trancada';
      } else if (situacaoFinal.includes('Cancelada')) {
        situacaoClass = 'cancelada';
      } else if (freqPorcentagem < 75) {
        freqClass = 'danger';
      } else if (freqPorcentagem < 85) {
        freqClass = 'warning';
      }

      let mediaClass = 'approved';
      if (media < 5) mediaClass = 'failed';
      else if (media < 7) mediaClass = 'recovery';

      return `
        <tr class="${ehStatusX ? 'row-status-x' : ''}">
          <td style="font-weight: 700; color: var(--text-muted);">${aluno.numeroChamada}</td>
          <td>
            <div class="student-cell-modern">
              <img src="${aluno.foto}" alt="${aluno.nome}" class="student-avatar-modern" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=c3161c&color=fff'">
              <div class="student-meta-modern">
                <span class="student-name-modern">${aluno.nome}</span>
                <span class="student-ra-modern">${aluno.ra} &bull; Subturma ${aluno.subturma}</span>
                <span class="student-subturma-badge">${aluno.subturma}</span>
              </div>
            </div>
          </td>
          <td class="count-cell" style="text-align: center;">${totalAulasDadas}</td>
          <td class="count-cell presencas" style="text-align: center;">${presencas}</td>
          <td class="count-cell faltas" style="text-align: center;">${faltas}</td>
          <td class="count-cell atrasos" style="text-align: center;">${atrasos}</td>
          <td class="count-cell dispensas" style="text-align: center;">${dispensas}</td>
          <td class="count-cell compensadas" style="text-align: center;">${faltasCompensadas}</td>
          <td class="freq-cell ${freqClass}" style="text-align: center;">${freqPorcentagem}%</td>
          <td style="text-align: center;">
            <div class="media-display ${mediaClass}">${ehStatusX ? '-' : media.toFixed(1)}</div>
          </td>
          <td style="text-align: center;">
            <span class="situacao-badge ${situacaoClass}">${situacaoFinal}</span>
          </td>
        </tr>
      `;
    }).join('');

    // Renderizar legenda
    this.renderizarLegenda(legendaContainer);
  }

  calcularEstatisticasTurma(alunos) {
    const ativos = alunos.filter(item => item.aluno.statusMatricula === 'ATIVO');
    if (!ativos.length) {
      return { mediaTurma: 0, freqMedia: 0, aprovados: 0, recuperacao: 0, retidosNota: 0, retidosFalta: 0, total: 0 };
    }

    let somaMedias = 0, somaFreq = 0;
    let aprovados = 0, recuperacao = 0, retidosNota = 0, retidosFalta = 0;

    ativos.forEach(item => {
      somaMedias += item.media;
      somaFreq += item.freqPorcentagem;
      if (item.situacaoFinal === 'Aprovado') aprovados++;
      else if (item.situacaoFinal.includes('Recuperação')) recuperacao++;
      else if (item.situacaoFinal.includes('Retido por Nota')) retidosNota++;
      else if (item.situacaoFinal.includes('Retido por Falta')) retidosFalta++;
    });

    return {
      mediaTurma: (somaMedias / ativos.length).toFixed(1),
      freqMedia: Math.round(somaFreq / ativos.length),
      aprovados,
      recuperacao,
      retidosNota,
      retidosFalta,
      total: ativos.length
    };
  }

  renderizarCardsResumo(container, stats, totalAulas) {
    if (!container) return;
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Média da Turma</span>
          <div class="stat-card-icon grades"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
        </div>
        <div class="stat-card-value">${stats.mediaTurma}</div>
        <div class="stat-card-sublabel">${stats.total} alunos ativos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Frequência Média</span>
          <div class="stat-card-icon attendance"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
        </div>
        <div class="stat-card-value" style="color: ${stats.freqMedia >= 75 ? '#16a34a' : stats.freqMedia >= 60 ? '#d97706' : 'var(--senai-red)'}">${stats.freqMedia}%</div>
        <div class="stat-card-sublabel">${totalAulas} aulas ministradas</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Aprovados</span>
          <div class="stat-card-icon attendance"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
        <div class="stat-card-value" style="color: #16a34a;">${stats.aprovados}</div>
        <div class="stat-card-sublabel">${stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0}% dos ativos</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Em Risco (Recup. + Retidos)</span>
          <div class="stat-card-icon danger"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
        </div>
        <div class="stat-card-value" style="color: var(--senai-red);">${stats.recuperacao + stats.retidosNota + stats.retidosFalta}</div>
        <div class="stat-card-sublabel">Recuperação: ${stats.recuperacao} | Retidos Nota: ${stats.retidosNota} | Retidos Falta: ${stats.retidosFalta}</div>
      </div>
    `;
  }

  renderizarLegenda(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="situacao-legenda-item aprovado"><span class="situacao-badge aprovado" style="padding: 2px 8px; font-size: 10px;">Aprovado</span> Média ≥ 70 e Freq. ≥ 75%</div>
      <div class="situacao-legenda-item recuperacao"><span class="situacao-badge recuperacao" style="padding: 2px 8px; font-size: 10px;">Recuperação</span> Média 50 - 69</div>
      <div class="situacao-legenda-item retido"><span class="situacao-badge retido-nota" style="padding: 2px 8px; font-size: 10px;">Retido por Nota</span> Média < 50</div>
      <div class="situacao-legenda-item retido"><span class="situacao-badge retido-falta" style="padding: 2px 8px; font-size: 10px;">Retido por Falta</span> Frequência < 75%</div>
      <div class="situacao-legenda-item trancada"><span class="situacao-badge trancada" style="padding: 2px 8px; font-size: 10px;">Trancada/Cancelada</span> Status X</div>
    `;
  }
}

window.sinteseController = new SinteseController();
