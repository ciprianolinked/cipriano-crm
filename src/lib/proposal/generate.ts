import { brand } from "@/lib/brand";
import { calcTotals, suggestDiscount } from "@/lib/proposal/catalog";
import { generateMaintenanceProposal } from "@/lib/proposal/maintenance-plan";
import type {
  Briefing,
  ProposalDraft,
  ProposalItem,
  ProposalSection,
  ProposalType,
  SectionTableRow,
} from "@/lib/proposal/types";

export type GeneratorSettings = {
  defaultValidityDays: number;
  defaultPaymentTerms: string;
  defaultDeliveryTime: string;
  defaultWarranty: string;
  companyName: string;
  legalName: string;
  director: string;
  role: string;
  crea: string;
  cnpj: string;
};

export const defaultGeneratorSettings: GeneratorSettings = {
  defaultValidityDays: 15,
  defaultPaymentTerms:
    "40% de entrada na assinatura · 60% na entrega técnica (ou 12× no cartão corporativo)",
  defaultDeliveryTime: "12 dias úteis após aceite e liberação da obra",
  defaultWarranty: "24 meses equipamentos · 12 meses mão de obra",
  companyName: brand.name,
  legalName: brand.legalName,
  director: brand.director,
  role: brand.role,
  crea: brand.crea,
  cnpj: brand.cnpj,
};

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const item = (
  kind: ProposalItem["kind"],
  desc: string,
  spec: string,
  unit: string,
  qty: number,
  price: number,
): ProposalItem => ({ id: uid("it"), kind, desc, spec, unit, qty, price });

const section = (
  id: string,
  title: string,
  body: string,
  extra: Partial<ProposalSection> = {},
): ProposalSection => ({ id, title, body, enabled: true, kind: "text", ...extra });

const bullets = (list: string[]) => list.filter(Boolean).map((l) => `• ${l}`).join("\n");

export function buildItems(briefing: Briefing, type: ProposalType, artIncluded: boolean): ProposalItem[] {
  const items: ProposalItem[] = [];
  const points = Math.max(
    1,
    briefing.cameras + briefing.doors + (briefing.intercom ? 1 : 0) + (briefing.alarm ? 2 : 0),
  );

  if (briefing.cameras > 0) {
    items.push(
      item(
        "equipamento",
        "Câmera IP Bullet 4K ColorVu",
        "Hikvision DS-2CD2087 · PoE · IR 40 m · IP67 · imagem colorida 24 h",
        "un",
        briefing.cameras,
        1290,
      ),
      item(
        "equipamento",
        "NVR 16 canais com 8 TB",
        'Rack 19" · RAID 1 · retenção de 30 dias · gravação 4K',
        "un",
        Math.max(1, Math.ceil(briefing.cameras / 16)),
        5480,
      ),
    );
  }

  if (briefing.doors > 0) {
    items.push(
      item(
        "equipamento",
        "Controle de acesso biométrico facial",
        "Facial + RFID · fechadura eletroímã 150 kgf · botoeira e sensor de porta",
        "porta",
        briefing.doors,
        3150,
      ),
    );
  }

  if (briefing.fenceMeters > 0) {
    items.push(
      item(
        "equipamento",
        "Cerca elétrica perimetral",
        "6 fios de aço inox 0,9 mm · central monitorada · sinalização a cada 3 m",
        "m",
        briefing.fenceMeters,
        96,
      ),
    );
  }

  if (briefing.alarm) {
    items.push(
      item(
        "equipamento",
        "Central de alarme monitorado",
        "Painel híbrido · sensores IVP · sirene 110 dB · bateria 12 h",
        "vb",
        1,
        2650,
      ),
    );
  }

  if (briefing.intercom) {
    items.push(
      item(
        "equipamento",
        "Interfonia IP com vídeo",
        "Posto externo SIP · integração com fechadura e app do morador",
        "vb",
        1,
        2400,
      ),
    );
  }

  if (briefing.network || briefing.cameras > 0 || briefing.doors > 0) {
    items.push(
      item(
        "equipamento",
        "Infraestrutura de rede, rack e energia protegida",
        "Cat6 blindado · switch PoE gerenciável 24p · nobreak 1,5 kVA · aterramento e DPS",
        "vb",
        1,
        4200,
      ),
    );
  }

  if (type !== "produtos_servicos") {
    items.push(
      item(
        "servico",
        "Instalação, configuração e comissionamento",
        "Fixação, passagem de cabos, ponteiras, configuração de software e testes de aceite",
        "ponto",
        points,
        320,
      ),
      item("servico", "Treinamento operacional da equipe", "4 h presencial · manual do operador · gravação", "turma", 1, 850),
    );
    if (artIncluded) {
      items.push(
        item(
          "servico",
          "Projeto executivo, ART e as-built",
          "Planta de pontos, topologia, memorial descritivo, ART CREA-SP e as-built",
          "vb",
          1,
          2400,
        ),
      );
    }
    if (briefing.monitoring) {
      items.push(
        item(
          "servico",
          "Monitoramento NOC 24 h",
          "Verificação de imagem, ronda virtual e SLA de atendimento em 4 h",
          "mês",
          12,
          390,
        ),
      );
    }
    if (briefing.maintenance) {
      items.push(
        item(
          "servico",
          "Manutenção preventiva e corretiva",
          "Preventiva mensal: lentes, conectores, firmware, baterias e backup de configuração",
          "mês",
          12,
          490,
        ),
      );
    }
  } else {
    if (briefing.monitoring) {
      items.push(
        item("servico", "Monitoramento NOC 24 h", "Ronda virtual e SLA de 4 h úteis", "mês", 12, 390),
      );
    }
    if (briefing.maintenance) {
      items.push(item("servico", "Manutenção preventiva mensal", "Preventiva completa do parque instalado", "mês", 12, 490));
    }
    if (briefing.monitoring === false && briefing.maintenance === false) {
      items.push(
        item(
          "servico",
          "Configuração e integração de sistema",
          "Ajuste de rede, cadastro de usuários e validação de gravação",
          "h",
          4,
          280,
        ),
      );
    }
  }

  return items;
}

function scopeList(briefing: Briefing, artIncluded: boolean): string[] {
  const lines: string[] = [];
  if (briefing.cameras > 0) {
    lines.push(
      `CFTV IP: ${briefing.cameras} câmeras 4K ColorVu, PoE, IR de 40 m, com imagem colorida 24 h e gravação em NVR com retenção de 30 dias.`,
      "Analítico de vídeo: linha virtual, detecção de intrusão e contagem de pessoas, com alerta no celular do responsável e clipe de 15 s.",
    );
  }
  if (briefing.doors > 0) {
    lines.push(
      `Controle de acesso em ${briefing.doors} porta(s): leitor facial + RFID, fechadura eletroímã de 150 kgf, botoeira, sensor de porta e cadastro de usuários por grupo e horário.`,
    );
  }
  if (briefing.fenceMeters > 0) {
    lines.push(
      `Perímetro: ${briefing.fenceMeters} m de cerca elétrica com 6 fios de aço inox, central monitorada, bateria selada de 12 h e sinalização de advertência a cada 3 m.`,
    );
  }
  if (briefing.alarm) {
    lines.push("Alarme monitorado: central híbrida, sensores de presença, sirene de 110 dB e bateria de retaguarda de 12 h.");
  }
  if (briefing.intercom) {
    lines.push("Interfonia IP com vídeo integrada ao controle de acesso e ao aplicativo do morador.");
  }
  lines.push(
    "Rede dedicada: cabeamento Cat6 blindado, switch PoE gerenciável, identificação de pontos e VLANs separadas entre CFTV e rede corporativa.",
    "Aterramento e proteção elétrica do rack e dos equipamentos de campo (DPS, DR e equipotencialização).",
    "Comissionamento com testes de gravação, acesso, detecção e alarme, registrados em termo assinado.",
    "Treinamento operacional de 4 h e entrega do manual do operador.",
  );
  if (artIncluded) {
    lines.push("Projeto executivo, ART CREA-SP e documentação as-built entregues ao final da obra.");
  }
  if (briefing.monitoring) {
    lines.push("Monitoramento NOC 24 h com ronda virtual e SLA de atendimento remoto em até 4 h úteis.");
  }
  if (briefing.maintenance) {
    lines.push("Manutenção preventiva mensal inclusa no contrato de 12 meses.");
  }
  return lines;
}

function responsabilityRows(): SectionTableRow[] {
  return [
    { label: "Projeto executivo e detalhamento técnico", cipriano: "Responsável", client: "Aprovação em até 3 dias úteis" },
    { label: "ART CREA-SP e laudo de aterramento", cipriano: "Responsável", client: "Guarda dos documentos" },
    { label: "Equipamentos, licenças e configuração", cipriano: "Responsável", client: "—" },
    { label: "Infraestrutura de rede e cabeamento previsto", cipriano: "Responsável", client: "—" },
    { label: "Ponto de energia 127/220 V e quadro elétrico", cipriano: "Solicita especificação", client: "Executa e disponibiliza" },
    { label: "Obra civil, alvenaria, pintura e infraestrutura extra", cipriano: "—", client: "Responsável" },
    { label: "Liberação de acesso, janelas e acompanhante", cipriano: "Agenda", client: "Disponibiliza" },
    { label: "Aterramento dedicado (quando não contratado)", cipriano: "Especifica", client: "Executa" },
    { label: "Treinamento da equipe operacional", cipriano: "Executa", client: "Disponibiliza operadores" },
    { label: "Operação diária, senhas e guarda de imagens", cipriano: "Suporte", client: "Responsável" },
    { label: "Manutenção preventiva após a garantia", cipriano: "Ofertada em contrato", client: "Contrata" },
    { label: "Tratamento de dados e LGPD", cipriano: "Adequação técnica", client: "Base legal e política de uso" },
  ];
}

export function buildSections(input: {
  type: ProposalType;
  briefing: Briefing;
  clientName: string;
  site: string;
  artIncluded: boolean;
  deliveryTime: string;
  warranty: string;
  validityDays: number;
}): ProposalSection[] {
  const { type, briefing, clientName, site, artIncluded, deliveryTime, warranty, validityDays } = input;
  const client = clientName.trim() || "o cliente";
  const location = site.trim() || "endereço da obra a confirmar";
  const systemPieces = [
    briefing.cameras > 0 ? `${briefing.cameras} câmeras IP 4K` : "",
    briefing.doors > 0 ? `${briefing.doors} porta(s) com controle de acesso` : "",
    briefing.fenceMeters > 0 ? `${briefing.fenceMeters} m de cerca elétrica` : "",
    briefing.alarm ? "alarme monitorado" : "",
    briefing.intercom ? "interfonia IP" : "",
    "infraestrutura de rede e energia protegida",
  ]
    .filter(Boolean)
    .join(", ");

  const objeto = `Fornecimento, instalação, configuração e comissionamento de sistema de segurança eletrônica IP para ${client}, contemplando ${systemPieces}${
    briefing.monitoring ? ", com monitoramento 24 h pelo NOC Cipriano" : ""
  }, treinamento operacional da equipe${artIncluded ? " e documentação técnica as-built ao final da obra" : ""}.\n\nLocal de instalação: ${location}. Segmento: ${briefing.segment.toLowerCase()}.`;

  const empresa = `${brand.name} projeta, instala e mantém sistemas de segurança eletrônica IP desde 2014. São 480 instalações entregues, 1.240 câmeras em campo e uptime de 99,98% no NOC próprio.\n\nA empresa atua com engenharia e equipe técnica próprias, documentação completa — do projeto executivo ao as-built — e atendimento a condomínios, indústrias, varejo, clínicas e residências de alto padrão na Grande São Paulo. Registro técnico: ${defaultGeneratorSettings.crea} · CNPJ ${defaultGeneratorSettings.cnpj}.\n\nTrabalhamos com números antes de adjetivos: cada equipamento é especificado, não vendido como “alta qualidade”.`;

  const objetivo = `Reduzir pontos cegos e dar previsibilidade à operação de segurança de ${client}, permitindo identificar e reagir a um evento em menos de 8 segundos, manter registro de imagens por 30 dias e controlar quem entra — e quando entra — em cada acesso.\n\nO sistema deve operar 24 h por dia, com verificação remota do NOC e alerta imediato ao responsável técnico do cliente.${
    briefing.priority === "orcamento"
      ? "\n\nDado o foco em orçamento, a proposta prioriza o perímetro crítico e organiza o restante em fases, preservando a possibilidade de expansão sem substituição de equipamentos."
      : briefing.priority === "prazo"
        ? "\n\nDado o prazo curto, o escopo usa kit padronizado em estoque, com mobilização imediata após o aceite."
        : briefing.priority === "tecnica"
          ? "\n\nDado o nível de exigência técnica, o escopo inclui projeto executivo, ART e memorial descritivo completo, com rastreabilidade documental."
          : "\n\nO foco é redução de risco: perímetro protegido, analítico de vídeo e tempo de resposta curto."
  }`;

  const escopo = bullets(scopeList(briefing, artIncluded));

  const metodologia = bullets([
    "Etapa 1 — Diagnóstico e briefing: visita técnica, levantamento de pontos, validação de infraestrutura e definição de zonas de segurança (1 a 2 dias úteis).",
    "Etapa 2 — Projeto executivo: planta de pontos, topologia, quadro de endereçamento IP, lista de materiais e cronograma. Aprovado por escrito pelo cliente antes da compra.",
    "Etapa 3 — Infraestrutura: lançamento de cabos, fixes, racks, aterramento e proteção elétrica, com identificação de todos os pontos.",
    "Etapa 4 — Instalação e configuração: montagem, endereçamento, gravação, regras de acesso, analítico e integrações.",
    "Etapa 5 — Comissionamento e entrega: testes documentados, treinamento de 4 h, entrega do as-built e do termo de aceite.",
  ]);

  const layout = `O sistema será distribuído a partir de um rack central em ${location}, com cabeamento estruturado até os pontos de campo.\n\n${bullets([
    `CFTV: ${briefing.cameras > 0 ? `${briefing.cameras} pontos de câmera posicionados em acessos, circulação e perímetro, a 2,80–3,20 m de altura, com campo de visão validado em planta.` : "não contemplado nesta configuração."}`,
    `Gravação: NVR central com ${Math.max(1, Math.ceil(briefing.cameras / 16))} unidade(s), retenção de 30 dias e espelhamento opcional em nuvem.`,
    briefing.doors > 0
      ? `Acesso: ${briefing.doors} porta(s) com leitor facial e fechadura eletroímã, controlador instalado no lado seguro (interno).`
      : "Acesso: não contemplado nesta configuração.",
    briefing.fenceMeters > 0
      ? `Perímetro: ${briefing.fenceMeters} m de cerca com central instalada em local abrigado e acesso restrito.`
      : "Perímetro: não contemplado nesta configuração.",
    "Rack: nobreak, switch PoE gerenciável, NVR e organização de cabos, com identificação e quadro de endereçamento.",
    "O layout detalhado (planta de pontos as-built, diagrama de topologia e detalhamento do rack) é consolidado no projeto executivo e aprovado antes da execução. Alterações após aprovação são tratadas como adicional.",
  ])}`;

  const equipamentos = bullets([
    "Equipamentos novos, de primeira linha, com nota fiscal, datasheet e garantia do fabricante.",
    "Especificações completas na tabela de itens desta proposta; qualquer substituição exige aprovação por escrito e mantém ou melhora o desempenho.",
    "Sujeito à disponibilidade de estoque na data do aceite — itens equivalentes só com autorização formal do cliente.",
  ]);

  const normas = bullets([
    "ABNT NBR 5410 — instalações elétricas de baixa tensão (circuitos, DR, DPS e proteções).",
    "ABNT NBR 14565 — cabeamento estruturado para redes de dados.",
    "ABNT NBR IEC 60335-2-76 — segurança de cercas elétricas; sinalização e energização conforme norma.",
    "ABNT NBR 5419 — proteção contra descargas atmosféricas, quando houver SPDA no local.",
    "ABNT NBR 17240 — sistemas de detecção e alarme de incêndio, quando aplicável.",
    "NR-10 (segurança em instalações elétricas) e NR-35 (trabalho em altura) para toda a equipe de campo.",
    "Resolução ANATEL nº 715/2019 para cabeamento de telecomunicações, quando aplicável.",
    "Lei nº 13.709/2018 (LGPD) para tratamento de imagens e dados de usuários do controle de acesso.",
  ]);

  const aterramento = `${bullets([
    "Malha de terra dedicada ao sistema de segurança, com resistência máxima de 10 Ω, medida por terrômetro e registrada em laudo.",
    "Condutores de proteção dimensionados conforme NBR 5410, com equipotencialização de rack, eletrocalhas, caixas e carcaças metálicas.",
    "DPS classe II no quadro de alimentação dos equipamentos e DR de 30 mA nos circuitos de campo.",
    "Nobreak nas cargas críticas (NVR, switch e controladores), com autonomia mínima de 30 min.",
    "Integração com o SPDA existente quando houver, sem alteração da estrutura de captação.",
  ])}\n\nSe o aterramento não estiver contemplado nos itens desta proposta, será especificado pela Cipriano e executado pelo cliente por profissional habilitado, com medição e laudo antes da energização.`;

  const consideracoes = bullets([
    "Os preços incluem materiais, mão de obra, deslocamento na Grande São Paulo, impostos e frete. Serviços em outras regiões têm logística orçada à parte.",
    "O cliente deve garantir acesso ao local, áreas de trabalho livres, janelas de execução e um responsável técnico para aprovações.",
    "Interrupções no fornecimento de energia, danos por terceiros, vandalismo e descargas atmosféricas não são de responsabilidade da Cipriano.",
    "Os prazos são contados em dias úteis e começam no aceite formal e na liberação de obra (e não na emissão desta proposta).",
    "Alterações de escopo somente são executadas após orçamento complementar aprovado por escrito; nenhuma mudança é feita por acordo verbal.",
    "Reajuste anual pelo IPCA para contratos de monitoramento e manutenção após 12 meses.",
    "O tratamento de imagens e dados de acesso deve observar a política de uso do cliente e a LGPD; a Cipriano atua como operadora técnica.",
  ]);

  const foraEscopo = bullets([
    "Obras civis, alvenaria, pintura, reparos de gesso e passagem de infraestrutura em áreas não previstas.",
    "Reforma ou ampliação de quadros elétricos, pontos de energia 127/220 V e instalação de SPDA.",
    "Cabeamento corporativo, link de internet, firewall e rede lógica fora do escopo descrito.",
    "Licenças, taxas públicas, aprovações de condomínio, bombeiros e concessionárias.",
    "Hospedagem em nuvem, licenças de software de terceiros e integrações com sistemas não listados.",
    "Migração de sistema legado, remoção de equipamentos antigos e descarte de materiais.",
    "Mobiliário, suportes especiais e estruturas metálicas não especificadas.",
    "Operação diária, gestão de imagens e guarda de senhas — responsabilidade do cliente.",
    "Projetos de detecção de incêndio e automação predial não citados nesta proposta.",
  ]);

  const matriz = bullets([
    "A matriz abaixo define quem executa cada frente do projeto. Dúvidas de interface são resolvidas em reunião registrada em ata antes da mobilização.",
  ]);

  const art = artIncluded
    ? `${bullets([
        `ART (Anotação de Responsabilidade Técnica) emitida no CREA-SP sob ${defaultGeneratorSettings.crea}, com profissional habilitado responsável pela execução.`,
        "Projeto executivo com planta de pontos, topologia de rede, detalhamento de rack, esquema de aterramento e quadro de endereçamento IP.",
        "Memorial descritivo e lista de materiais conforme executado.",
        "Documentação as-built, datasheets dos equipamentos e laudo de aterramento.",
        "Termo de comissionamento com testes de gravação, acesso, detecção e continuidade.",
        "Manual do operador e registro de treinamento assinado pela equipe do cliente.",
      ])}\n\nA documentação é entregue em PDF, organizada por disciplina, e também fica disponível no painel Cipriano do cliente.`
    : `A emissão de ART, o projeto executivo detalhado e a documentação as-built não estão inclusos nesta proposta.\n\nPara obras de maior valor, condomínios e exigências de síndico ou seguradora, recomendamos incluir esse pacote: ele documenta a responsabilidade técnica, garante rastreabilidade e reduz questionamentos futuros. Pode ser acrescido por aditivo, com valor informado à parte.`;

  const valor = `O investimento total desta proposta é apresentado abaixo, com desconto comercial já aplicado. Valores em reais (BRL), com impostos inclusos, válidos pela data de emissão.\n\nO resumo de itens, quantidades e preços unitários está detalhado no bloco de produtos e serviços. O parcelamento sugerido é de 12× sem juros no cartão corporativo ou conforme condição de pagamento acordada.`;

  const condicoes = bullets([
    `Pagamento: ${defaultGeneratorSettings.defaultPaymentTerms}.`,
    `Prazo de execução: ${deliveryTime}.`,
    `Garantia: ${warranty}.`,
    `Validade da proposta: ${validityDays} dias corridos a partir da emissão.`,
    "Horas técnicas adicionais: R$ 140,00/hora por profissional, com aprovação prévia por e-mail.",
    "Frete e deslocamento inclusos na Grande São Paulo; demais regiões sob consulta.",
    "Emissão de nota fiscal eletrônica contra o CNPJ do cliente, com impostos inclusos.",
  ]);

  const prazo = `${bullets([
    `O prazo de referência é de ${deliveryTime}, contado do aceite formal e da liberação de obra.`,
    `Mobilização em até 3 dias úteis após a entrada e a aprovação do projeto executivo.`,
    "Cronograma típico: semana 1 infraestrutura · semana 2 instalação e configuração · semana 3 comissionamento, treinamento e entrega.",
    "Atrasos por falta de energia, acesso, obra civil ou aprovação do cliente deslocam o cronograma na mesma proporção, com registro por e-mail.",
    "Monitoramento e manutenção iniciam após o termo de comissionamento.",
  ])}\n\n${deliveryTime}`;

  const garantia = `${bullets([
    warranty + ".",
    "Cobertura de equipamentos conforme fabricante, com intermediação da Cipriano no acionamento da garantia.",
    "Garantia de mão de obra cobre instalação, configuração, passagem de cabos, fixes e comissionamento.",
    "Não cobertos: vandalismo, furto, descargas atmosféricas, intervenção de terceiros, sobrecarga elétrica e falta de manutenção preventiva contratada.",
    "Atendimento remoto em até 4 h úteis e visita técnica em até 24 h úteis na Grande São Paulo.",
    "Peças fora de garantia são orçadas previamente e só substituídas após aprovação.",
  ])}`;

  const validade = `Esta proposta é válida por ${validityDays} dias corridos a partir da data de emissão.\n\nApós esse prazo, valores e disponibilidade de equipamentos podem ser reajustados. O aceite dentro da validade garante o preço e a condição de pagamento aqui descritos.`;

  const confidencialidade = bullets([
    "As informações técnicas, comerciais e financeiras desta proposta são confidenciais e destinadas exclusivamente à avaliação do cliente.",
    "É vedada a reprodução, distribuição ou uso por terceiros sem autorização por escrito da Cipriano Tech & Security.",
    "Plantas, topologias, configurações, senhas e documentação as-built são de uso restrito do cliente e da Cipriano.",
    "Imagens e dados de acesso devem ser tratados conforme a LGPD (Lei 13.709/2018), com base legal definida pelo cliente.",
    "O sigilo permanece por 5 anos após o encerramento do contrato, salvo obrigação legal ou judicial.",
  ]);

  const aceite = `Para formalizar o aceite, assine o campo abaixo, devolva este documento em PDF para ${brand.email} ou responda o e-mail de envio com a expressão “de acordo”.\n\nO pedido será vinculado ao número desta proposta e à data de assinatura. A execução inicia somente após o aceite formal e a liberação de obra.`;

  const sections: Record<string, ProposalSection> = {
    objeto: section("objeto", "Objeto", objeto),
    empresa: section("empresa", `Sobre a ${brand.name}`, empresa),
    objetivo: section("objetivo", "Objetivo", objetivo),
    escopo: section("escopo", "Escopo dos Serviços", escopo),
    metodologia: section("metodologia", "Metodologia e Etapas de Execução", metodologia),
    layout: section("layout", "Layout", layout),
    equipamentos: section(
      "equipamentos",
      "Lista de Equipamentos e Serviços",
      equipamentos,
      { kind: "items" },
    ),
    normas: section("normas", "Normas Aplicáveis", normas),
    aterramento: section("aterramento", "Aterramento", aterramento),
    consideracoes: section("consideracoes", "Considerações Gerais", consideracoes),
    fora_escopo: section("fora_escopo", "Fora do Escopo de Serviços", foraEscopo),
    matriz: section("matriz", "Matriz de Responsabilidade", matriz, {
      kind: "table",
      rows: responsabilityRows(),
    }),
    art: section("art", "ART e Projeto — Documentos", art, { enabled: artIncluded }),
    valor: section("valor", "Valor", valor, { kind: "totals", locked: true }),
    condicoes: section("condicoes", "Condições Comerciais", condicoes, { kind: "terms" }),
    prazo: section("prazo", "Prazo de Entrega", prazo),
    garantia: section("garantia", "Garantia", garantia),
    validade: section("validade", "Validade da Proposta", validade),
    confidencialidade: section("confidencialidade", "Confidencialidade", confidencialidade),
    aceite: section("aceite", "Aceite", aceite),
  };

  const completeOrder: (keyof typeof sections)[] = [
    "objeto",
    "empresa",
    "objetivo",
    "escopo",
    "metodologia",
    "layout",
    "equipamentos",
    "normas",
    "aterramento",
    "consideracoes",
    "fora_escopo",
    "matriz",
    "art",
    "valor",
    "condicoes",
    "prazo",
    "garantia",
    "validade",
    "confidencialidade",
    "aceite",
  ];

  if (type === "completa") return completeOrder.map((key) => sections[key]);

  if (type === "simples") {
    return [
      sections.objeto,
      section(
        "escopo",
        "Escopo resumido",
        bullets(scopeList(briefing, artIncluded).slice(0, 5)),
      ),
      sections.equipamentos,
      sections.valor,
      sections.condicoes,
      section("validade", "Validade", `${validade}\n\nGarantia: ${warranty}.`),
      sections.aceite,
    ];
  }

  return [
    section(
      "objeto",
      "Objeto",
      `Fornecimento de produtos e/ou serviços de segurança eletrônica para ${client}: ${systemPieces}. Local: ${location}.\n\nOrçamento sem escopo de projeto executivo; itens e quantidades conforme levantamento do cliente.`,
    ),
    section("equipamentos", "Produtos e Serviços", "Quantidades orçadas conforme solicitação. Itens de serviço estão identificados na tabela.", {
      kind: "items",
    }),
    sections.valor,
    section(
      "condicoes",
      "Condições Comerciais",
      bullets([
        `Pagamento: ${defaultGeneratorSettings.defaultPaymentTerms}.`,
        `Entrega/execução: ${deliveryTime}.`,
        `Garantia: ${warranty}.`,
        `Validade: ${validityDays} dias corridos.`,
        "Frete incluso na Grande São Paulo; fora da região sob consulta.",
        "Produtos sujeitos à disponibilidade de estoque na data do aceite.",
      ]),
      { kind: "terms" },
    ),
    section(
      "observacoes",
      "Observações",
      bullets([
        "Este orçamento contempla somente os itens listados — instalação e infraestrutura apenas quando descritas na tabela.",
        "Não inclui projeto executivo, ART, obra civil, pontos de energia ou licenças.",
        "Para converter este orçamento em contrato de instalação com projeto e garantia estendida, solicite a proposta completa.",
      ]),
    ),
    sections.aceite,
  ];
}

export function generateProposal(input: {
  type: ProposalType;
  briefing: Briefing;
  clientName: string;
  contact: string;
  clientEmail: string;
  site: string;
  validityDays?: number;
  discountPct?: number;
  artIncluded?: boolean;
  settings?: Partial<GeneratorSettings>;
}): ProposalDraft {
  const settings = { ...defaultGeneratorSettings, ...input.settings };
  if (input.briefing.purpose === "manutencao_mensal") return generateMaintenanceProposal({ ...input, settings });
  const briefing = input.briefing;
  const artIncluded = input.artIncluded ?? input.type === "completa";
  const validityDays = input.validityDays ?? settings.defaultValidityDays;
  const discountPct = input.discountPct ?? suggestDiscount(briefing, input.type);
  const deliveryTime = settings.defaultDeliveryTime;
  const warranty = settings.defaultWarranty;
  const items = buildItems(briefing, input.type, artIncluded);
  const sections = buildSections({
    type: input.type,
    briefing,
    clientName: input.clientName,
    site: input.site,
    artIncluded,
    deliveryTime,
    warranty,
    validityDays,
  });

  calcTotals(items, discountPct);

  return {
    type: input.type,
    clientName: input.clientName.trim() || "Cliente a definir",
    contact: input.contact,
    clientEmail: input.clientEmail,
    site: input.site,
    validityDays,
    discountPct,
    items,
    sections,
    paymentTerms: settings.defaultPaymentTerms,
    deliveryTime,
    warranty,
    artIncluded,
    briefing,
  };
}

export const SECTION_LIBRARY: { title: string; body: string; kind?: ProposalSection["kind"] }[] = [
  {
    title: "SLA e Níveis de Serviço",
    body: bullets([
      "Atendimento remoto em até 4 h úteis para chamados críticos.",
      "Visita técnica em até 24 h úteis na Grande São Paulo.",
      "Disponibilidade mensal alvo de 99,5%, medida pelo NOC.",
      "Relatório mensal de chamados, disponibilidade e manutenções.",
    ]),
  },
  {
    title: "Treinamento",
    body: bullets([
      "Treinamento operacional de 4 h para até 8 pessoas.",
      "Manual do operador e gravação da sessão entregues em PDF.",
      "Reciclagem anual inclusa em contratos de manutenção.",
    ]),
  },
  {
    title: "LGPD e Tratamento de Imagens",
    body: bullets([
      "A Cipriano atua como operadora técnica; a base legal é do cliente.",
      "Acesso às imagens restrito a usuários nominados.",
      "Retenção padrão de 30 dias, configurável por escrito.",
      "Registro de auditoria de acessos e exportações.",
    ]),
  },
  {
    title: "Plano de Expansão",
    body: bullets([
      "Rack e switch dimensionados com 30% de folga para novos pontos.",
      "Licenças do NVR com margem para até 16 canais adicionais.",
      "Cabeamento identificado, permitindo novas câmeras sem retrabalho.",
      "Valores de expansão congelados por 6 meses após o aceite.",
    ]),
  },
  {
    title: "Anexo — Topologia Proposta",
    body: "As câmeras IP são alimentadas e transportadas por um único cabo Cat6 blindado (PoE 802.3af) até o switch gerenciável do rack central. O NVR grava em circuito local, com espelhamento noturno para a nuvem e acesso remoto pelo app Cipriano View (iOS/Android).\n\nO perímetro usa central monitorada com bateria selada (autonomia de 12 h) e sirene de 110 dB. Eventos geram push no celular do responsável e clipe de 15 s no NOC.",
  },
];
