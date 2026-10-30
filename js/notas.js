/**
 * =============================================================================
 * RENOVA SENAI - NOTAS E MÉDIAS (notas.js)
 * Cadastro de Avaliações, Digitação de Notas, Cálculo Automático e Médias
 * Layout Moderno com Cards de Estatísticas e Tabela Aprimorada
 * =============================================================================
 */

class NotasController {
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
    const sel = document.getElementById('selectNotasTurma');
    if (!sel) return;
    const turmas = window.db.getTurmas('EM_ANDAMENTO');
    sel.innerHTML = turmas.map(t => `<option value="${t.id}">${t.codigo} - ${t.nome}</option>`).join('');
    sel.value = this.turmaId;
  }

  carregarUCsSelect() {
    const sel = document.getElementById('selectNotasUC');
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
    const thead = document.getElementById('notasTableHead');
    const tbody = document.getElementById('notasTableBody');
    const resumoContainer = document.getElementById('notasResumoCards');
    const legendaContainer = document.getElementById('notasLegenda');
    if (!thead || !tbody) return;

    const avaliacoes = window.db.getAvaliacoesPorUC(this.turmaId, this.ucId);
    const alunos = window.db.getAlunosPorTurma(this.turmaId);
    const alunosAtivos = alunos.filter(a => a.statusMatricula === 'ATIVO');

    // Calcular estatísticas para cards de resumo
    const stats = this.calcularEstatisticasTurma(alunosAtivos, avaliacoes);
    this.renderizarCardsResumo(resumoContainer, stats);

    // Cabeçalho dinâmico das avaliações
    thead.innerHTML = `
      <tr>
        <th style="width: 45px;">Nº</th>
        <th style="min-width: 220px;">Aluno</th>
        ${avaliacoes.map(av => `
          <th style="text-align: center; width: 120px;">
            <div style="font-weight: 700;">${av.titulo}</div>
            <div style="font-size: 10px; font-weight: normal; color: var(--text-muted); margin-top: 2px;">
              Peso: ${av.peso} &bull; Máx: ${av.valorMaximo}
            </div>
          </th>
        `).join('')}
        <th style="text-align: center; width: 110px;">Média Final</th>
        <th style="text-align: center; width: 150px;">Situação</th>
      </tr>
    `;

    // Linhas dos alunos
    tbody.innerHTML = alunos.map(aluno => {
      const ehStatusX = (aluno.statusMatricula === 'TRANCADO' || aluno.statusMatricula === 'CANCELADO');

      if (ehStatusX) {
        return `
          <tr class="row-status-x">
            <td>${aluno.numeroChamada}</td>
            <td>
              <div class="student-cell-modern">
                <img src="${aluno.foto}" alt="${aluno.nome}" class="student-avatar-modern" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=c3161c&color=fff'">
                <div class="student-meta-modern">
                  <span class="student-name-modern">${aluno.nome}</span>
                  <span class="student-ra-modern">${aluno.ra} &bull; Subturma ${aluno.subturma}</span>
                </div>
              </div>
            </td>
            <td colspan="${avaliacoes.length + 2}" style="text-align: center; padding: 24px;">
              <span class="status-x-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                STATUS X - MATRÍCULA ${aluno.statusMatricula} (BLOQUEADO)
              </span>
            </td>
          </tr>
        `;
      }

      const { media, situacao } = window.db.calcularMediaAluno(this.turmaId, this.ucId, aluno.id);

      const celulasNotas = avaliacoes.map(av => {
        const notaValor = window.db.getNota(av.id, aluno.id);
        const displayVal = (notaValor !== null && !isNaN(notaValor)) ? notaValor : '';
        let gradeClass = '';
        if (notaValor !== null && !isNaN(notaValor)) {
          if (notaValor >= 70) gradeClass = 'grade-approved';
          else if (notaValor >= 50) gradeClass = 'grade-recovery';
          else gradeClass = 'grade-failed';
        }

        return `
          <td class="grade-input-cell">
            <input type="number" step="1" min="0" max="100" 
              class="grade-input ${gradeClass}" 
              value="${displayVal}"
              onchange="window.notasController.salvarNota(${av.id}, ${aluno.id}, this.value)"
              placeholder="0"
              title="${av.titulo} - Peso: ${av.peso} - Máx: ${av.valorMaximo}">
          </td>
        `;
      }).join('');

      let situacaoClass = 'aprovado';
      let mediaClass = 'approved';
      if (situacao === 'Em Recuperação') {
        situacaoClass = 'recuperacao';
        mediaClass = 'recovery';
      } else if (situacao === 'Retido por Nota') {
        situacaoClass = 'retido-nota';
        mediaClass = 'failed';
      } else if (situacao.includes('Falta')) {
        situacaoClass = 'retido-falta';
        mediaClass = 'failed';
      }

      return `
        <tr>
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
          ${celulasNotas}
          <td style="text-align: center;">
            <div class="media-display ${mediaClass}">${media.toFixed(1)}</div>
          </td>
          <td style="text-align: center;">
            <span class="situacao-badge ${situacaoClass}">${situacao}</span>
          </td>
        </tr>
      `;
    }).join('');

    // Renderizar legenda
    this.renderizarLegenda(legendaContainer);
    if (window.app && window.app._aplicarModoObservador) {
      window.app._aplicarModoObservador('notas');
    }
  }

  calcularEstatisticasTurma(alunos, avaliacoes) {
    if (!alunos.length || !avaliacoes.length) {
      return { mediaTurma: 0, aprovados: 0, recuperacao: 0, retidos: 0, total: 0 };
    }

    let somaMedias = 0;
    let aprovados = 0, recuperacao = 0, retidos = 0;

    alunos.forEach(aluno => {
      const { media, situacao } = window.db.calcularMediaAluno(this.turmaId, this.ucId, aluno.id);
      somaMedias += media;
      if (situacao === 'Aprovado') aprovados++;
      else if (situacao === 'Em Recuperação') recuperacao++;
      else if (situacao.includes('Retido')) retidos++;
    });

    return {
      mediaTurma: alunos.length ? (somaMedias / alunos.length).toFixed(1) : 0,
      aprovados,
      recuperacao,
      retidos,
      total: alunos.length
    };
  }

  renderizarCardsResumo(container, stats) {
    if (!container) return;
    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Média da Turma</span>
          <div class="stat-card-icon grades"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
        </div>
        <div class="stat-card-value">${stats.mediaTurma}</div>
        <div class="stat-card-sublabel">${stats.total} alunos avaliados</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Aprovados</span>
          <div class="stat-card-icon attendance"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
        <div class="stat-card-value" style="color: #16a34a;">${stats.aprovados}</div>
        <div class="stat-card-sublabel">${stats.total > 0 ? Math.round((stats.aprovados / stats.total) * 100) : 0}% da turma</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Em Recuperação</span>
          <div class="stat-card-icon warning"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>
        </div>
        <div class="stat-card-value" style="color: #d97706;">${stats.recuperacao}</div>
        <div class="stat-card-sublabel">Necessitam atenção</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-title">Retidos</span>
          <div class="stat-card-icon danger"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>
        </div>
        <div class="stat-card-value" style="color: var(--senai-red);">${stats.retidos}</div>
        <div class="stat-card-sublabel">Por nota ou frequência</div>
      </div>
    `;
  }

  renderizarLegenda(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="situacao-legenda-item aprovado"><span class="situacao-badge aprovado" style="padding: 2px 8px; font-size: 10px;">Aprovado</span> Média ≥ 70</div>
      <div class="situacao-legenda-item recuperacao"><span class="situacao-badge recuperacao" style="padding: 2px 8px; font-size: 10px;">Recuperação</span> Média 50 - 69</div>
      <div class="situacao-legenda-item retido"><span class="situacao-badge retido-nota" style="padding: 2px 8px; font-size: 10px;">Retido por Nota</span> Média < 50</div>
      <div class="situacao-legenda-item retido"><span class="situacao-badge retido-falta" style="padding: 2px 8px; font-size: 10px;">Retido por Falta</span> Frequência < 75%</div>
      <div class="situacao-legenda-item trancada"><span class="situacao-badge trancada" style="padding: 2px 8px; font-size: 10px;">Trancada/Cancelada</span> Status X</div>
    `;
  }

  salvarNota(avaliacaoId, alunoId, valor) {
    if (window.auth && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Ação bloqueada: a Coordenação atua exclusivamente em Modo Observador.', 'warning');
      return;
    }
    if (valor === '' || isNaN(valor)) return;
    const num = Math.min(100, Math.max(0, parseFloat(valor)));
    window.db.salvarNota(avaliacaoId, alunoId, num);
    this.renderizar();
  }

  salvarNovaAvaliacao() {
    if (window.auth && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Ação bloqueada: a Coordenação atua exclusivamente em Modo Observador.', 'warning');
      return;
    }
    const titulo = document.getElementById('inputNovaAvaliacaoTitulo').value;
    const tipo = document.getElementById('selectNovaAvaliacaoTipo').value;
    const peso = parseFloat(document.getElementById('inputNovaAvaliacaoPeso').value) || 1.0;
    const data = document.getElementById('inputNovaAvaliacaoData').value;
    const valorMaximo = parseFloat(document.getElementById('inputNovaAvaliacaoValorMaximo').value) || 100;

    if (!titulo) {
      window.app.mostrarToast('Informe o título da avaliação.', 'warning');
      return;
    }

    window.db.addAvaliacao({
      turmaId: this.turmaId,
      ucId: this.ucId,
      titulo,
      tipo,
      peso,
      valorMaximo,
      data: data || new Date().toISOString().split('T')[0]
    });

    window.app.fecharModal('modalNovaAvaliacao');
    window.app.mostrarToast('Avaliação cadastrada com sucesso!', 'success');
    this.renderizar();
  }
}

window.notasController = new NotasController();
