export interface TemplateVariables {
  cliente: string;
  visitante: string;
  empresa?: string;
  tipo?: string;
  motivo: string;
  horario: string;
  veiculo?: string;
  placa?: string;
  codigo?: string;
  observacao?: string;
  operador?: string;
}

export function parseMessageTemplate(template: string, vars: TemplateVariables): string {
  let content = template;

  content = content.replace(/\{\{cliente\}\}/gi, vars.cliente);
  content = content.replace(/\{\{visitante\}\}/gi, vars.visitante);
  content = content.replace(/\{\{empresa\}\}/gi, vars.empresa || 'Não informada');
  content = content.replace(/\{\{tipo\}\}/gi, vars.tipo || 'Visitante');
  content = content.replace(/\{\{motivo\}\}/gi, vars.motivo);
  content = content.replace(/\{\{horario\}\}/gi, vars.horario);
  content = content.replace(
    /\{\{veiculo\}\}/gi,
    vars.veiculo ? `${vars.veiculo}${vars.placa ? ` (Placa: ${vars.placa})` : ''}` : 'Nenhum'
  );
  content = content.replace(/\{\{placa\}\}/gi, vars.placa || '');
  content = content.replace(/\{\{codigo\}\}/gi, vars.codigo || '');

  // Observação
  if (vars.observacao && vars.observacao.trim()) {
    content = content.replace(/\{\{observacao\}\}/gi, vars.observacao.trim());
    content = content.replace(/\{\{notas\}\}/gi, vars.observacao.trim());
  } else {
    // Se não há observação, remove a linha inteira do placeholder para não ficar em branco
    content = content.replace(/[^\n]*\{\{observacao\}\}[^\n]*\n?/gi, '');
    content = content.replace(/[^\n]*\{\{notas\}\}[^\n]*\n?/gi, '');
  }

  // Operador
  const opName = (vars.operador && vars.operador.trim()) ? vars.operador.trim() : 'Portaria';
  content = content.replace(/\{\{operador\}\}/gi, opName);
  content = content.replace(/\{\{porteiro\}\}/gi, opName);

  // Se o template NÃO possuía placeholder de observação e há observação informada
  if (vars.observacao && vars.observacao.trim() && !template.includes('{{observacao}}') && !template.includes('{{notas}}')) {
    const obsBlock = `📝 *Observação:* ${vars.observacao.trim()}`;
    if (content.includes('Para responder')) {
      content = content.replace('Para responder', `${obsBlock}\n\nPara responder`);
    } else if (content.includes('Deseja autorizar')) {
      content = content.replace('Deseja autorizar', `${obsBlock}\n\nDeseja autorizar`);
    } else {
      content += `\n${obsBlock}`;
    }
  }

  // Se o template NÃO possuía placeholder de operador
  if (!template.includes('{{operador}}') && !template.includes('{{porteiro}}')) {
    const opBlock = `👮‍♂️ *Solicitado por:* ${opName}`;
    if (content.includes('Para responder')) {
      content = content.replace('Para responder', `${opBlock}\n\nPara responder`);
    } else if (content.includes('Deseja autorizar')) {
      content = content.replace('Deseja autorizar', `${opBlock}\n\nDeseja autorizar`);
    } else {
      content += `\n${opBlock}`;
    }
  }

  return content.replace(/\n{3,}/g, '\n\n');
}

export const DEFAULT_APPROVAL_TEMPLATE = `Olá, *{{cliente}}*!

Há um visitante aguardando sua autorização na portaria.

👤 *Visitante:* {{visitante}}
🏢 *Empresa:* {{empresa}}
📋 *Tipo:* {{tipo}}
🎯 *Motivo:* {{motivo}}
📅 *Data e Horário:* {{horario}}
🚗 *Veículo:* {{veiculo}}
🔖 *Solicitação:* {{codigo}}
📝 *Observação:* {{observacao}}
👮‍♂️ *Solicitado por:* {{operador}}

Deseja autorizar a entrada?
Responda com:
*1* para *AUTORIZAR*
*2* para *RECUSAR*`;

export const DEFAULT_REMINDER_TEMPLATE = `⏳ Olá, *{{cliente}}*!

O visitante *{{visitante}}* ainda aguarda sua liberação na portaria (Ref: {{codigo}} | Solicitado por: {{operador}}).

Por favor, responda com:
*1* para *AUTORIZAR* ou *2* para *RECUSAR*.`;
