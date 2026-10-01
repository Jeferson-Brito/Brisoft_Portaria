export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const digit = (base: string, factors: number[]) => {
    const sum = factors.reduce((total, factor, index) => total + Number(base[index]) * factor, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = digit(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

export async function cnpjExistsAtRevenue(value: string) {
  const cnpj = onlyDigits(value);
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error('Não foi possível consultar o CNPJ agora.');
  }
  return true;
}
