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
  content = content.replace(/\{\{observacao\}\}/gi, vars.observacao || '');
  content = content.replace(/\{\{notas\}\}/gi, vars.observacao || '');
  content = content.replace(/\{\{operador\}\}/gi, vars.operador || 'Portaria');
  content = content.replace(/\{\{porteiro\}\}/gi, vars.operador || 'Portaria');

  // Se o template não tinha placeholder para observação mas há observação informada, adiciona antes da pergunta de autorização
  if (vars.observacao && !template.includes('{{observacao}}') && !template.includes('{{notas}}')) {
    const obsBlock = `\n📝 *Observação:* ${vars.observacao}`;
    if (content.includes('Deseja autorizar')) {
      content = content.replace('Deseja autorizar', `${obsBlock}\n\nDeseja autorizar`);
    } else {
      content += `\n${obsBlock}`;
    }
  }

  // Se o template não tinha placeholder para operador mas há operador informado, adiciona
  if (vars.operador && !template.includes('{{operador}}') && !template.includes('{{porteiro}}')) {
    const opBlock = `\n👮‍♂️ *Solicitado por:* ${vars.operador}`;
    if (content.includes('Deseja autorizar')) {
      content = content.replace('Deseja autorizar', `${opBlock}\n\nDeseja autorizar`);
    } else {
      content += `\n${opBlock}`;
    }
  }

  return content;
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
👮‍♂️ *Solicitado por:* {{operador}}

Deseja autorizar a entrada?
Responda com:
*1* para *AUTORIZAR*
*2* para *RECUSAR*`;

export const DEFAULT_REMINDER_TEMPLATE = `⏳ Olá, *{{cliente}}*!

O visitante *{{visitante}}* ainda aguarda sua liberação na portaria (Ref: {{codigo}} | Solicitado por: {{operador}}).

Por favor, responda com:
*1* para *AUTORIZAR* ou *2* para *RECUSAR*.`;
