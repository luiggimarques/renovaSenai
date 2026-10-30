/**
 * =============================================================================
 * RENOVA SENAI - MÓDULO DIÁRIO DE CLASSE (diario.js)
 * Chamada simples com Week Picker visual (Seg-Sex)
 * =============================================================================
 */

class DiarioController {
  constructor() {
    this.turmaId = 1;
    this.ucId = 1;
    this.subturma = 'TODOS';
    this.dataAula = new Date().toISOString().split('T')[0];
    this.periodo = 'Tarde';
    this.quantidadeAulas = 4;
    this.frequencias = {}; // { [alunoId]: ['C', 'C', 'C', 'C'] }
    
    // Week Picker
    this.semanaAtual = null; // Date do domingo inicial da semana
    this.diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  }

  async init() {
    this.carregarTurmasSelect();
    this.carregarUCsSelect();
    await this.irParaHoje(); // Inicializa semanaAtual e renderiza pills
    this.carregarChamada();
  }

  // Retorna Date do domingo da semana da data dada (0=Dom)
  getInicioSemana(data) {
    // [Remoção de prefixo/parâmetro 'd'] Substituído 'd' por nome descritivo 'dataRef'
    const dataRef = new Date(data);
    const day = dataRef.getDay(); // 0=Dom, 1=Seg...
    const diff = dataRef.getDate() - day; // Domingo da semana
    return new Date(dataRef.setDate(diff));
  }

  // Retorna array de 5 Dates (Seg-Sex) da semanaAtual
  getDiasUteisSemana() {
    const inicio = new Date(this.semanaAtual);
    const dias = [];
    for (let i = 1; i <= 5; i++) { // 1=Seg ... 5=Sex
      // [Remoção de prefixo/parâmetro 'd'] Substituído 'd' por nome descritivo 'dataItem'
      const dataItem = new Date(inicio);
      dataItem.setDate(inicio.getDate() + i);
      dias.push(dataItem);
    }
    return dias;
  }

  // Navega semanas (delta = -1 anterior, +1 próxima)
  async navegarSemana(delta) {
    const nova = new Date(this.semanaAtual);
    nova.setDate(nova.getDate() + delta * 7);
    this.semanaAtual = this.getInicioSemana(nova);
    await this.renderWeekPicker();
    this.carregarChamada();
  }

  // Volta para semana de hoje
  async irParaHoje() {
    this.semanaAtual = this.getInicioSemana(new Date());
    await this.renderWeekPicker();
    this.carregarChamada();
  }

  // Seleciona um dia da semana
  async selecionarDiaSemana(dataStr) {
    this.dataAula = dataStr;
    this.frequencias = {}; // LIMPA estado local ao mudar de dia
    const inputHidden = document.getElementById('inputDiarioData');
    if (inputHidden) inputHidden.value = dataStr;
    await this.renderWeekPicker(); // Re-render para marcar selected
    this.carregarChamada();  // Carrega a chamada do dia (agora lê do banco)
  }

  // Renderiza os 5 pills (Seg-Sex) com indicadores de chamada salva
  async renderWeekPicker() {
    const container = document.getElementById('diarioWeekPills');
    const inputHidden = document.getElementById('inputDiarioData');
    if (!container) return;

    const dias = this.getDiasUteisSemana();
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    // Busca quais dias têm chamada salva nesta semana
    const inicioSemana = dias[0].toISOString().split('T')[0];
    const fimSemana = dias[4].toISOString().split('T')[0];
    const diasComChamada = await this.buscarDiasComChamada(inicioSemana, fimSemana);

    container.innerHTML = dias.map((dia, idx) => {
      const dataStr = dia.toISOString().split('T')[0];
      const isHoje = dia.getTime() === hoje.getTime();
      const isSelecionado = this.dataAula === dataStr;
      const temChamada = diasComChamada.includes(dataStr);

      return `
        <button type="button" 
          class="week-pill ${isHoje ? 'today' : ''} ${isSelecionado ? 'selected' : ''} ${temChamada ? 'has-chamada' : ''}"
          onclick="window.diarioController.selecionarDiaSemana('${dataStr}')"
          aria-label="${this.diasSemana[idx]}, ${dia.getDate()}/${dia.getMonth()+1}"
          title="${this.diasSemana[idx]}, ${dia.getDate()}/${dia.getMonth()+1}${temChamada ? ' • Chamada salva' : ''}">
          <span class="dia-nome">${this.diasSemana[idx]}</span>
          <span class="dia-numero">${dia.getDate()}</span>
        </button>
      `;
    }).join('');

    // NÃO sobrescreve dataAula - mantém a selecionada
    if (inputHidden) inputHidden.value = this.dataAula;
  }

  // Busca dias com chamada salva no período (usa DB)
  async buscarDiasComChamada(inicio, fim) {
    return window.db.getChamadasPorPeriodo(this.turmaId, this.ucId, inicio, fim);
  }

  carregarTurmasSelect() {
    const sel = document.getElementById('selectDiarioTurma');
    if (!sel) return;
    const turmas = window.db.getTurmas('EM_ANDAMENTO');
    sel.innerHTML = turmas.map(t => `<option value="${t.id}">${t.codigo} - ${t.nome}</option>`).join('');
    sel.value = this.turmaId;
    const turma = turmas.find(t => t.id === this.turmaId);
    this.atualizarInfoBadge(turma);
  }

  carregarUCsSelect() {
    const sel = document.getElementById('selectDiarioUC');
    if (!sel) return;
    const ucs = window.db.getUCsPorTurma(this.turmaId);
    sel.innerHTML = ucs.map(u => `<option value="${u.id}">${u.codigo} - ${u.nome}</option>`).join('');
    if (ucs.length) {
      this.ucId = ucs[0].id;
      sel.value = this.ucId;
    }
  }

  atualizarInfoBadge(turma) {
    const badge = document.getElementById('diarioInfoTurma');
    if (badge && turma) {
      badge.textContent = `${turma.codigo} • ${turma.periodo}`;
    }
  }

  async onTurmaChange(novaTurmaId) {
    this.turmaId = Number(novaTurmaId);
    this.frequencias = {}; // Limpa ao trocar turma
    this.carregarUCsSelect();
    const turma = window.db.getTurmaById(this.turmaId);
    this.atualizarInfoBadge(turma);
    await this.renderWeekPicker(); // Aguarda render
    this.carregarChamada();
  }

  async onUCChange(novaUCId) {
    this.ucId = Number(novaUCId);
    this.frequencias = {}; // Limpa ao trocar UC
    await this.renderWeekPicker(); // Aguarda render
    this.carregarChamada();
  }

  carregarChamada() {
    console.log('[Diário] carregarChamada:', { turmaId: this.turmaId, ucId: this.ucId, data: this.dataAula, subturma: this.subturma, qtdAulas: this.quantidadeAulas });
    
    const container = document.getElementById('diarioChamadaTableBody');
    if (!container) {
      console.error('[Diário] Container não encontrado!');
      return;
    }

    // SÓ carrega do banco se NÃO temos dados locais (inicialização)
    // Isso evita sobrescrever alterações não salvas a cada clique
    if (Object.keys(this.frequencias).length === 0) {
      const chamadaExistente = window.db.getChamada(this.turmaId, this.ucId, this.dataAula, this.periodo, this.subturma);

      if (chamadaExistente) {
        this.quantidadeAulas = chamadaExistente.quantidadeAulas || 4;
        this.frequencias = JSON.parse(JSON.stringify(chamadaExistente.frequencias || {}));
        const inputQtd = document.getElementById('inputDiarioQtdAulas');
        if (inputQtd) inputQtd.value = this.quantidadeAulas;
      } else {
        this.frequencias = {};
      }
    }

    const alunos = window.db.getAlunosPorTurma(this.turmaId, this.subturma);
    const dentroDoPrazo = window.db.isDataDentroDoPrazo(this.dataAula);

    // Alerta de prazo - AVISA mas NÃO BLOQUEIA
    const alertaPrazo = document.getElementById('diarioAlertaPrazo');
    if (alertaPrazo) {
      if (!dentroDoPrazo) {
        alertaPrazo.style.display = 'flex';
        alertaPrazo.innerHTML = `⚠️ <strong>Atenção:</strong> Esta aula tem mais de ${window.db.data.config.prazoEdicaoDias} dias. Você pode editar, mas será registrado como alteração tardia.`;
      } else {
        alertaPrazo.style.display = 'none';
      }
    }

    // Atualizar seletor de qtd aulas
    const inputQtd = document.getElementById('inputDiarioQtdAulas');
    if (inputQtd) inputQtd.value = this.quantidadeAulas;

    // Renderizar linhas
    container.innerHTML = alunos.map(aluno => {
      const ehStatusX = (aluno.statusMatricula === 'TRANCADO' || aluno.statusMatricula === 'CANCELADO');
      const justificativa = window.db.getJustificativaParaData(aluno.id, this.dataAula);
      const atrasosAcumulados = window.db.getAtrasosAcumulados(aluno.id, this.ucId);

      // Frequência consolidada para badge visual
      let freqCritica = false;
      let freqPorcentagem = 100;
      if (!ehStatusX) {
        const sintese = window.db.getSinteseConsolidada(this.turmaId, this.ucId);
        const alunoSintese = sintese.alunos.find(item => item.aluno.id === aluno.id);
        if (alunoSintese) {
          freqPorcentagem = alunoSintese.freqPorcentagem;
          freqCritica = freqPorcentagem < window.db.data.config.frequenciaMinimaPorcentagem;
        }
      }

      // Inicializar frequências se não existirem
      if (!this.frequencias[aluno.id]) {
        if (ehStatusX) {
          this.frequencias[aluno.id] = Array(this.quantidadeAulas).fill('X');
        } else if (justificativa) {
          this.frequencias[aluno.id] = Array(this.quantidadeAulas).fill('D');
        } else {
          this.frequencias[aluno.id] = Array(this.quantidadeAulas).fill('C');
        }
      }

      // Células de frequência (botões C/F/A/D)
      let celulasHtml = '';
      if (ehStatusX) {
        celulasHtml = `<td colspan="${this.quantidadeAulas}" style="text-align:center; padding:20px;">
          <span class="status-x-badge">STATUS X - ${aluno.statusMatricula} (BLOQUEADO)</span>
        </td>`;
      } else {
        for (let i = 0; i < this.quantidadeAulas; i++) {
          const status = this.frequencias[aluno.id][i] || 'C';
          const disabledF = justificativa ? 'disabled style="opacity:0.3;cursor:not-allowed;" title="Bloqueado por atestado"' : '';
          celulasHtml += `
            <td style="text-align:center;">
              <div class="freq-selector-group">
                <button class="btn-freq-opt ${status==='C'?'active-C':''}" onclick="window.diarioController.setFrequencia(${aluno.id},${i},'C')" title="Presente">C</button>
                <button class="btn-freq-opt ${status==='F'?'active-F':''}" ${disabledF} onclick="window.diarioController.setFrequencia(${aluno.id},${i},'F')" title="Falta">F</button>
                <button class="btn-freq-opt ${status==='A'?'active-A':''}" onclick="window.diarioController.setFrequencia(${aluno.id},${i},'A')" title="Atraso">A</button>
                <button class="btn-freq-opt ${status==='D'?'active-D':''}" onclick="window.diarioController.setFrequencia(${aluno.id},${i},'D')" title="Dispensa">D</button>
              </div>
            </td>`;
        }
      }

      // Badges
      let badges = '';
      if (justificativa) badges += `<span class="justified-pill-badge">🏥 ${justificativa.tipo}</span>`;
      if (atrasosAcumulados >= 5) badges += `<span class="delays-warning-chip">⚠️ ${atrasosAcumulados} atrasos</span>`;
      else if (atrasosAcumulados > 0) badges += `<span style="font-size:11px;color:#b45309;font-weight:600;">${atrasosAcumulados} atraso(s)</span>`;
      if (freqCritica) badges += `<span class="freq-critical-badge">🔴 ${freqPorcentagem}% CRÍTICO</span>`;
      else if (freqPorcentagem < 85) badges += `<span style="font-size:11px;color:#d97706;font-weight:600;">⚠ ${freqPorcentagem}%</span>`;

      const rowClass = ehStatusX ? 'row-status-x' : (freqCritica ? 'row-freq-critical' : '');

      return `
        <tr class="${rowClass}">
          <td style="width:40px;font-weight:700;color:var(--text-muted);">${aluno.numeroChamada}</td>
          <td>
            <div class="student-cell">
              <img src="${aluno.foto}" alt="${aluno.nome}" class="student-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&background=c3161c&color=fff'">
              <div class="student-meta">
                <span class="student-name">${aluno.nome}</span>
                <span class="student-ra">${aluno.ra} • Subturma ${aluno.subturma}</span>
                <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">${badges}</div>
              </div>
            </div>
          </td>
          ${celulasHtml}
        </tr>`;
    }).join('');

    console.log('[Diário] Renderizados', alunos.length, 'alunos');

    // Cabeçalho da tabela
    const theadRow = document.getElementById('diarioChamadaTableHeadRow');
    if (theadRow) {
      let ths = '';
      for (let i = 1; i <= this.quantidadeAulas; i++) ths += `<th style="text-align:center;width:90px;">Aula ${i}</th>`;
      theadRow.innerHTML = `<th style="width:45px;">Nº</th><th style="min-width:220px;">Aluno</th>${ths}`;
    }
    if (window.app && window.app._aplicarModoObservador) {
      window.app._aplicarModoObservador('diario');
    }
  }

  setFrequencia(alunoId, aulaIndex, novoStatus) {
    console.log('[Diário] setFrequencia CLICADO:', { alunoId, aulaIndex, novoStatus });
    if (window.auth && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Visualização somente leitura: o perfil de Coordenação não pode alterar presenças.', 'info');
      return;
    }
    
    if (!this.frequencias[alunoId]) this.frequencias[alunoId] = Array(this.quantidadeAulas).fill('C');
    
    // Bloquear F se tem justificativa
    if (novoStatus === 'F' && window.db.getJustificativaParaData(alunoId, this.dataAula)) {
      window.app.mostrarToast('Aluno com atestado válido. Falta bloqueada!', 'warning');
      return;
    }
    this.frequencias[alunoId][aulaIndex] = novoStatus;
    console.log('[Diário] Frequência atualizada:', this.frequencias[alunoId]);
    this.carregarChamada(); // Re-render imediato para feedback visual
  }

  marcarTodosComoComparecimento() {
    if (window.auth && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Ação bloqueada: a Coordenação atua exclusivamente em Modo Observador.', 'warning');
      return;
    }
    const alunos = window.db.getAlunosPorTurma(this.turmaId, this.subturma);
    alunos.forEach(aluno => {
      if (aluno.statusMatricula === 'ATIVO') {
        const justificativa = window.db.getJustificativaParaData(aluno.id, this.dataAula);
        this.frequencias[aluno.id] = Array(this.quantidadeAulas).fill(justificativa ? 'D' : 'C');
      }
    });
    this.carregarChamada();
    window.app.mostrarToast('Todos marcados como Presente [C]', 'success');
  }

  salvarChamada() {
    if (window.auth && window.auth.isCoordenacao()) {
      window.app.mostrarToast('Ação bloqueada: a Coordenação atua exclusivamente em Modo Observador.', 'warning');
      return;
    }
    try {
      // Permite salvar mesmo se data antiga (só avisa)
      const resultado = window.db.salvarChamada({
        turmaId: this.turmaId,
        ucId: this.ucId,
        data: this.dataAula,
        periodo: this.periodo,
        subturma: this.subturma,
        quantidadeAulas: this.quantidadeAulas,
        frequencias: this.frequencias
      });

      this.verificarLimiteCriticoFrequencia();

      // [Compensação Manual pelo Professor] Notificações automáticas desativadas pois compensação agora é definida manualmente
      /*
      if (resultado.eventosAtrasosGerados?.length) {
        window.app.mostrarAlertaModal('Compensação por Atrasos', `Alunos com 5+ atrasos:\n• ${resultado.eventosAtrasosGerados.join('\n• ')}\n\nCompensação de 2h gerada.`);
      }
      if (resultado.eventosFaltasGerados?.length) {
        window.app.mostrarAlertaModal('Compensação por Faltas', `Alunos com frequência < 75%:\n${resultado.eventosFaltasGerados.join('\n')}\n\nCompensação gerada.`);
      }
      */

      window.app.mostrarToast('Chamada salva com sucesso!', 'success');
      this.carregarChamada();
      this.renderWeekPicker(); // Atualiza indicadores verdes
    } catch (e) {
      window.app.mostrarToast(e.message, 'warning');
    }
  }

  verificarLimiteCriticoFrequencia() {
    const alunos = window.db.getAlunosPorTurma(this.turmaId, this.subturma);
    const criticos = alunos.filter(a => a.statusMatricula === 'ATIVO').map(a => {
      const s = window.db.getSinteseConsolidada(this.turmaId, this.ucId).alunos.find(x => x.aluno.id === a.id);
      return s && s.freqPorcentagem < window.db.data.config.frequenciaMinimaPorcentagem ? {nome: a.nome, ra: a.ra, freq: s.freqPorcentagem, faltas: s.faltas} : null;
    }).filter(Boolean);

    if (criticos.length) {
      const msg = `⚠️ FREQUÊNCIA CRÍTICA (<${window.db.data.config.frequenciaMinimaPorcentagem}%):\n\n${criticos.map(c=>`• ${c.nome} (${c.ra}) - ${c.freq}% - ${c.faltas} faltas`).join('\n')}\n\nIr para aba Compensar?`;
      const elTit = document.getElementById('modalAlertaTitulo');
      const elMsg = document.getElementById('modalAlertaMensagem');
      const elFooter = document.querySelector('#modalAlertaGlobal .modal-footer');
      if (elTit && elMsg && elFooter) {
        elTit.innerText = 'Frequência Crítica Detectada';
        elMsg.innerText = msg;
        elMsg.style.whiteSpace = 'pre-line';
        elFooter.innerHTML = `<button class="btn btn-secondary" onclick="window.app.fecharModal('modalAlertaGlobal')">Agora não</button><button class="btn btn-primary" onclick="window.app.navegarPara('compensacoes');window.app.fecharModal('modalAlertaGlobal')">Ir para Compensar →</button>`;
        window.app.abrirModal('modalAlertaGlobal');
      }
    }
  }
}

window.diarioController = new DiarioController();

// Auto-inicializar quando a aba Diário for aberta
document.addEventListener('DOMContentLoaded', () => {
  // O init será chamado pelo app.js ao navegar para 'diario'
});