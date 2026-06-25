import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"
import { runDailyMatching } from "@/lib/conciliacao"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const empresaId = searchParams.get("empresaId")
    const dataInicio = searchParams.get("dataInicio")
    const dataFim = searchParams.get("dataFim")
    const filtroStatus = searchParams.get("status")
    const filtroBanco = searchParams.get("banco") || ""
    const filtroArquivo = searchParams.get("arquivo") || ""
    const filtroTipoParam = searchParams.get("tipo") // RECEITAS | DESPESAS
    const filtroTipo = filtroTipoParam === "RECEITAS" ? "CREDITO" : filtroTipoParam === "DESPESAS" ? "DEBITO" : undefined

    if (!empresaId || !dataInicio || !dataFim) {
      return NextResponse.json(
        { error: "empresaId, dataInicio e dataFim são obrigatórios" },
        { status: 400 }
      )
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    })

    if (!empresa || empresa.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Empresa não encontrada ou não pertence ao usuário" },
        { status: 403 }
      )
    }

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    fim.setHours(23, 59, 59, 999)

    // Buscar uploads da empresa
    const uploads = await prisma.uploadErp.findMany({
      where: { empresaId },
      select: { id: true }
    })
    const uploadIds = uploads.map(u => u.id)

    // Buscar contas bancárias
    const contas = await prisma.contaBancaria.findMany({
      where: { empresaId },
      select: { id: true, banco: true }
    })
    const contaMap = new Map(contas.map(c => [c.id, c.banco || ""]))
    const contaIds = contas.map(c => c.id)

    // Buscar importações
    const importacoes = await prisma.importacaoExtrato.findMany({
      where: { empresaId },
      select: { id: true, nomeArquivo: true }
    })
    const importacaoIds = importacoes.map(i => i.id)
    const importacaoArquivoMap = new Map(importacoes.map(i => [i.id, i.nomeArquivo || ""]))

    // Buscar lançamentos ERP
    let erpLancamentos = await prisma.erpLancamento.findMany({
      where: {
        uploadId: { in: uploadIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar extratos bancários (Open Finance)
    let extratoLancamentos = await prisma.extratoLancamento.findMany({
      where: {
        contaId: { in: contaIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // Buscar extratos importados (CSV/OFX)
    let extratosImportados = await prisma.extratoImportado.findMany({
      where: {
        importacaoId: { in: importacaoIds },
        data: { gte: inicio, lte: fim }
      },
      orderBy: { data: "asc" }
    })

    // === Aplicar filtros ativos (tipo, banco, arquivo) ===
    const normalizarBanco = (str?: string | null): string =>
      !str ? "" : str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const bancoNorm = normalizarBanco(filtroBanco)
    const temArquivo = !!filtroArquivo.trim()
    const arquivoCasa = (nome: string) =>
      !!nome && (nome.includes(filtroArquivo) || nome.startsWith(filtroArquivo))

    // Filtro por tipo (receitas/despesas)
    if (filtroTipo) {
      erpLancamentos = erpLancamentos.filter(l => l.tipo === filtroTipo)
      extratoLancamentos = extratoLancamentos.filter(l => l.tipo === filtroTipo)
      extratosImportados = extratosImportados.filter(l => l.tipo === filtroTipo)
    }

    // Filtro por banco/arquivo (mesma lógica híbrida do build-day)
    if (filtroBanco.trim()) {
      if (temArquivo) {
        erpLancamentos = erpLancamentos.filter(l =>
          l.banco && normalizarBanco(l.banco).includes(bancoNorm)
        )
        // Não filtrar extratos por banco quando arquivo foi especificado
      } else {
        erpLancamentos = erpLancamentos.filter(l =>
          l.banco && normalizarBanco(l.banco).includes(bancoNorm)
        )
        extratoLancamentos = extratoLancamentos.filter(l =>
          l.banco && normalizarBanco(l.banco).includes(bancoNorm)
        )
        extratosImportados = extratosImportados.filter(l =>
          l.banco && normalizarBanco(l.banco).includes(bancoNorm)
        )
      }
    }

    if (temArquivo) {
      extratosImportados = extratosImportados.filter(l =>
        importacaoArquivoMap.get(l.importacaoId) &&
        arquivoCasa(importacaoArquivoMap.get(l.importacaoId)!)
      )
    }

    // Buscar aprovações de lançamentos do período
    const aprovacoesLancamentoRaw = await prisma.aprovacaoLancamento.findMany({
      where: {
        empresaId,
        dataDia: { gte: inicio, lte: fim }
      }
    })
    // Aplicar filtro de banco por código (tolerante a variações de nome)
    const aprovacoesLancamento = filtroBanco.trim()
      ? aprovacoesLancamentoRaw.filter(a => a.extratoId && (extratoLancamentos.some(e => e.id === a.extratoId && e.banco && normalizarBanco(e.banco).includes(bancoNorm)) || extratosImportados.some(e => e.id === a.extratoId && e.banco && normalizarBanco(e.banco).includes(bancoNorm))))
      : aprovacoesLancamentoRaw
    const aprovacaoMap = new Map(
      aprovacoesLancamento.map(a => [a.extratoId, { status: a.status, updatedAt: a.updatedAt }])
    )

    // Buscar aprovações por dia no período
    const aprovacoesDiaRaw = await (prisma as any).aprovacaoDia.findMany({
      where: { 
        empresaId, 
        dataDia: { gte: inicio, lte: fim }
      }
    })
    // Aplicar filtro de banco por código
    const aprovacoesDia = filtroBanco.trim()
      ? aprovacoesDiaRaw.filter((a: any) => a.banco && normalizarBanco(a.banco).includes(bancoNorm))
      : aprovacoesDiaRaw
    const mapaDiaStatus: Record<string, string> = {}
    for (const a of aprovacoesDia as any[]) {
      const key = (a.dataDia as Date).toISOString().split("T")[0]
      mapaDiaStatus[key] = a.status
    }

    // Criar mapa de status de lançamentos
    const mapaLancamentoStatus: Record<string, string> = {}
    for (const a of aprovacoesLancamento as any[]) {
      mapaLancamentoStatus[a.extratoId] = a.status
    }

    // === ABA 1: Extrato Bancário ===
    const extratoRows = [
      ...extratoLancamentos.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Identificador: l.identificador || "",
        Banco: l.banco || contaMap.get(l.contaId) || "",
        "Status Aprovação": mapaLancamentoStatus[l.id] || ""
      })),
      ...extratosImportados.map(l => ({
        Data: new Date(l.data).toLocaleDateString("pt-BR"),
        Descricao: l.descricao,
        Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
        Valor: Number(l.valor),
        Identificador: l.identificador || "",
        Banco: l.banco || "",
        "Status Aprovação": mapaLancamentoStatus[l.id] || ""
      }))
    ]
    extratoRows.sort((a, b) => parseData(a.Data) - parseData(b.Data))

    // === ABA 2: ERP ===
    const erpRows = erpLancamentos.map(l => ({
      Data: new Date(l.data).toLocaleDateString("pt-BR"),
      Descricao: l.descricao,
      Tipo: l.tipo === "CREDITO" ? "Entrada" : "Saída",
      Valor: Number(l.valor),
      Documento: l.documento || "",
      Fornecedor: l.fornecedor || "",
      Banco: l.banco || "",
      Categoria: l.categoria || ""
    }))
    erpRows.sort((a, b) => parseData(a.Data) - parseData(b.Data))

    // === ABA 3: Resumo Diário ===
    const dias = new Set<string>()
    erpLancamentos.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))
    extratoLancamentos.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))
    extratosImportados.forEach(l => dias.add(new Date(l.data).toISOString().split("T")[0]))

    const diasOrdenados = Array.from(dias).sort()

    // Helper: se filtroStatus definido, verifica se o valor do item bate
    const passaFiltro = (valor: string) => !filtroStatus || valor === filtroStatus

    // Helper: exclui itens reprovados
    const naoReprovado = (valor: string) => valor !== "REPROVADO"

    const resumoRows = diasOrdenados.map(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const entradasErp = erpDia.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
      const saidasErp = erpDia.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)
      const entradasExtrato = [...extBancarioDia, ...extImportadoDia].filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
      const saidasExtrato = [...extBancarioDia, ...extImportadoDia].filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)

      return {
        Data: new Date(dataKey).toLocaleDateString("pt-BR"),
        "Entradas Extrato": entradasExtrato,
        "Saídas Extrato": saidasExtrato,
        "Saldo Extrato": entradasExtrato - saidasExtrato,
        "Entradas ERP": entradasErp,
        "Saídas ERP": saidasErp,
        "Saldo ERP": entradasErp - saidasErp,
        "Diferença Saldo": (entradasExtrato - saidasExtrato) - (entradasErp - saidasErp),
        "Status Dia": mapaDiaStatus[dataKey] || "AGUARDANDO"
      }
    }).filter(row => passaFiltro(row["Status Dia"]) && naoReprovado(row["Status Dia"]))

    // === ABA 4: Não Conciliados (extratos sem correspondência no ERP) ===
    const naoConciliadosRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const erpTxs = erpDia.map(e => ({
        id: e.id,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        documento: e.documento,
        fornecedor: e.fornecedor,
        banco: e.banco,
        categoria: e.categoria,
      }))

      const extTxs = [
        ...extBancarioDia.map(e => ({
          id: e.id,
          origem: "EXTRATO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco || contaMap.get(e.contaId) || null,
        })),
        ...extImportadoDia.map(e => ({
          id: e.id,
          origem: "EXTRATO_IMPORTADO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco,
        })),
      ]

      const { matching } = runDailyMatching(erpTxs, extTxs)

      return matching.extratosSobrando
        .filter(ex => mapaLancamentoStatus[ex.id] !== "APROVADO")
        .map(ex => ({
          Data: new Date(dataKey).toLocaleDateString("pt-BR"),
          Descricao: ex.descricao,
          Valor: ex.valor,
          Tipo: ex.tipo === "CREDITO" ? "Entrada" : "Saída",
          Origem: ex.origem === "EXTRATO" ? "Extrato Bancário" : "Extrato Importado",
          Banco: ex.banco || "",
          Identificador: ex.identificador || "",
          "Status Lançamento": mapaLancamentoStatus[ex.id] || "AGUARDANDO"
        })).filter(row => passaFiltro(row["Status Lançamento"]) && naoReprovado(row["Status Lançamento"]))
    })

    // === ABA 5: ERP Sobrando (ERP sem correspondência no extrato) ===
    const erpSobrandoRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const erpTxs = erpDia.map(e => ({
        id: e.id,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        documento: e.documento,
        fornecedor: e.fornecedor,
        banco: e.banco,
        categoria: e.categoria,
      }))

      const extTxs = [
        ...extBancarioDia.map(e => ({
          id: e.id,
          origem: "EXTRATO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco || contaMap.get(e.contaId) || null,
        })),
        ...extImportadoDia.map(e => ({
          id: e.id,
          origem: "EXTRATO_IMPORTADO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco,
        })),
      ]

      const { matching } = runDailyMatching(erpTxs, extTxs)

      return matching.erpsSobrando.map(erp => ({
        Data: new Date(dataKey).toLocaleDateString("pt-BR"),
        Descricao: erp.descricao,
        Valor: erp.valor,
        Tipo: erp.tipo === "CREDITO" ? "Entrada" : "Saída",
        Documento: erp.documento || "",
        Fornecedor: erp.fornecedor || "",
        Banco: erp.banco || "",
        Categoria: erp.categoria || "",
        "Status Dia": mapaDiaStatus[dataKey] || "AGUARDANDO"
      })).filter(row => passaFiltro(row["Status Dia"]) && naoReprovado(row["Status Dia"]))
    })

    const workbook = XLSX.utils.book_new()

    // Aba Extrato
    if (extratoRows.length > 0) {
      const wsExtrato = XLSX.utils.json_to_sheet(extratoRows)
      wsExtrato["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 25 }, { wch: 25 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsExtrato, "Extrato Bancário")
    }

    // Aba ERP
    if (erpRows.length > 0) {
      const wsErp = XLSX.utils.json_to_sheet(erpRows)
      wsErp["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsErp, "ERP (Relatório)")
    }

    // Aba Resumo Diário
    if (resumoRows.length > 0) {
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows)
      wsResumo["!cols"] = [
        { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo Diário")
    }

    // Aba Não Conciliados
    if (naoConciliadosRows.length > 0) {
      const wsNao = XLSX.utils.json_to_sheet(naoConciliadosRows)
      wsNao["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsNao, "Não Conciliados")
    }

    // Aba ERP Sobrando
    if (erpSobrandoRows.length > 0) {
      const wsErpSob = XLSX.utils.json_to_sheet(erpSobrandoRows)
      wsErpSob["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 14 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsErpSob, "ERP Sobrando")
    }

    // === ABA 6: Conciliados (ERP pareados com extrato, inclui se o extrato foi aprovado individualmente) ===
    const conciliadosRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      const erpTxs = erpDia.map(e => ({
        id: e.id,
        data: e.data,
        descricao: e.descricao,
        valor: Number(e.valor),
        tipo: e.tipo,
        documento: e.documento,
        fornecedor: e.fornecedor,
        banco: e.banco,
        categoria: e.categoria,
      }))

      const extTxs = [
        ...extBancarioDia.map(e => ({
          id: e.id,
          origem: "EXTRATO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco || contaMap.get(e.contaId) || null,
        })),
        ...extImportadoDia.map(e => ({
          id: e.id,
          origem: "EXTRATO_IMPORTADO" as const,
          data: e.data,
          descricao: e.descricao,
          valor: Number(e.valor),
          tipo: e.tipo,
          saldoApos: e.saldoApos ? Number(e.saldoApos) : null,
          identificador: e.identificador,
          banco: e.banco,
        })),
      ]

      const { matching } = runDailyMatching(erpTxs, extTxs)

      const pareadosAprovados = matching.itens
        .filter(item => item.extrato && mapaLancamentoStatus[item.extrato.id] === "APROVADO")
        .map(item => ({
          Data: new Date(dataKey).toLocaleDateString("pt-BR"),
          Descricao: item.erp?.descricao || "",
          Valor: item.erp?.valor ?? 0,
          Tipo: item.erp?.tipo === "CREDITO" ? "Entrada" : "Saída",
          Documento: item.erp?.documento || "",
          Fornecedor: item.erp?.fornecedor || "",
          Banco: item.erp?.banco || "",
          Categoria: item.erp?.categoria || "",
          "Status Matching": item.status === "CONCILIADO" ? "Conciliado" : "A Revisar",
          "Status Aprovação": mapaLancamentoStatus[item.extrato?.id || ""] || "",
          "Status Dia": mapaDiaStatus[dataKey] || "AGUARDANDO"
        }))

      // Extratos sem ERP que foram aprovados também vão para Conciliados
      const extratosSoAprovados = matching.extratosSobrando
        .filter(ex => mapaLancamentoStatus[ex.id] === "APROVADO")
        .map(ex => ({
          Data: new Date(dataKey).toLocaleDateString("pt-BR"),
          Descricao: ex.descricao,
          Valor: ex.valor,
          Tipo: ex.tipo === "CREDITO" ? "Entrada" : "Saída",
          Documento: "",
          Fornecedor: "",
          Banco: ex.banco || "",
          Categoria: "",
          "Status Matching": "Extrato Aprovado",
          "Status Aprovação": "APROVADO",
          "Status Dia": mapaDiaStatus[dataKey] || "AGUARDANDO"
        }))

      return [...pareadosAprovados, ...extratosSoAprovados]
        .filter(row => naoReprovado(row["Status Dia"]))
    })

    // Aba Conciliados
    if (conciliadosRows.length > 0) {
      const wsConc = XLSX.utils.json_to_sheet(conciliadosRows)
      wsConc["!cols"] = [
        { wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 14 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsConc, "Conciliados")
    }

    // === ABA 7: Resumo por Banco ===
    const resumoPorBancoRows = diasOrdenados.flatMap(dataKey => {
      const erpDia = erpLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extBancarioDia = extratoLancamentos.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)
      const extImportadoDia = extratosImportados.filter(l => new Date(l.data).toISOString().split("T")[0] === dataKey)

      // Resolver banco do extrato Open Finance via contaMap quando ausente
      const bancoExtBancario = (l: typeof extBancarioDia[number]) => l.banco || contaMap.get(l.contaId) || ""

      // Coletar todos os bancos únicos do dia
      const bancosDoDia = new Set<string>()
      erpDia.forEach(l => { if (l.banco) bancosDoDia.add(l.banco) })
      extBancarioDia.forEach(l => { const b = bancoExtBancario(l); if (b) bancosDoDia.add(b) })
      extImportadoDia.forEach(l => { if (l.banco) bancosDoDia.add(l.banco) })

      // Para cada banco, calcular totais
      return Array.from(bancosDoDia).map(banco => {
        const erpBanco = erpDia.filter(l => l.banco === banco)
        const extBanco = [
          ...extBancarioDia.filter(l => bancoExtBancario(l) === banco),
          ...extImportadoDia.filter(l => l.banco === banco)
        ]

        const entradasErp = erpBanco.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
        const saidasErp = erpBanco.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)
        const entradasExtrato = extBanco.filter(l => l.tipo === "CREDITO").reduce((s, l) => s + Number(l.valor), 0)
        const saidasExtrato = extBanco.filter(l => l.tipo === "DEBITO").reduce((s, l) => s + Number(l.valor), 0)

        return {
          Data: new Date(dataKey).toLocaleDateString("pt-BR"),
          Banco: banco,
          "Entradas Extrato": entradasExtrato,
          "Saídas Extrato": saidasExtrato,
          "Saldo Extrato": entradasExtrato - saidasExtrato,
          "Entradas ERP": entradasErp,
          "Saídas ERP": saidasErp,
          "Saldo ERP": entradasErp - saidasErp,
          "Diferença Saldo": (entradasExtrato - saidasExtrato) - (entradasErp - saidasErp),
          "Status Dia": mapaDiaStatus[dataKey] || "AGUARDANDO"
        }
      }).filter(row => passaFiltro(row["Status Dia"]) && naoReprovado(row["Status Dia"]))
    })

    // Aba Resumo por Banco
    if (resumoPorBancoRows.length > 0) {
      const wsResumoBanco = XLSX.utils.json_to_sheet(resumoPorBancoRows)
      wsResumoBanco["!cols"] = [
        { wch: 12 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }
      ]
      XLSX.utils.book_append_sheet(workbook, wsResumoBanco, "Resumo por Banco")
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="analise-dia-${dataInicio}-${dataFim}.xlsx"`
      }
    })
  } catch (error) {
    console.error("Erro ao exportar análise por dia:", error)
    return NextResponse.json(
      { error: "Erro ao exportar análise por dia" },
      { status: 500 }
    )
  }
}

function parseData(d: string): number {
  const [dd, mm, yyyy] = d.split("/")
  return new Date(`${yyyy}-${mm}-${dd}`).getTime()
}
