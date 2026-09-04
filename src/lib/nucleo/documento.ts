import { apenasDigitos } from './texto';

/**
 * Validação de CPF/CNPJ por dígito verificador.
 *
 * Isso não é preciosismo: o complemento do extrato do BB carrega números longos
 * que NÃO são documentos (id de transação Pix, nosso-número de boleto). Sem
 * conferir o dígito, o motor classificaria por um "CNPJ" inexistente e criaria
 * regras que nunca mais casariam com nada.
 */

export function validarCpf(valor: string): boolean {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function validarCnpj(valor: string): boolean {
  const cnpj = apenasDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digito = (ate: number): number => {
    let peso = ate - 7;
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(cnpj[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13]);
}

/**
 * CNPJ antes de CPF (senão os 11 primeiros dígitos de um CNPJ casariam como CPF)
 * e fronteiras de dígito nas duas pontas, para não recortar um pedaço de um
 * número maior — como o id de transação Pix que aparece no extrato do BB.
 */
const REGEX_PADRAO_DOCUMENTO =
  /(?<!\d)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14}|\d{11})(?!\d)/g;

export type TipoDocumento = 'cpf' | 'cnpj';

export interface DocumentoDetectado {
  numero: string;
  tipo: TipoDocumento;
}

/**
 * Extrai o primeiro CPF/CNPJ válido de um texto.
 *
 * @param texto        trecho do histórico (normalmente o complemento).
 * @param regexOrigem  regex cadastrada no template do banco (3.2 regex_documento).
 * @param validarDigito quando true, só aceita documento com dígito verificador ok.
 */
export function extrairDocumento(
  texto: string,
  regexOrigem?: string | null,
  validarDigito = true,
): DocumentoDetectado | null {
  const candidatos: string[] = [];

  if (regexOrigem?.trim()) {
    try {
      for (const achado of texto.matchAll(new RegExp(regexOrigem, 'g'))) {
        candidatos.push(achado[1] ?? achado[0]);
      }
    } catch {
      // Regex inválida no template não pode derrubar a importação.
    }
  }

  // Rede de segurança: a regex do template é editada à mão e pode, por exemplo,
  // listar \d{11} antes de \d{14} e recortar os 11 primeiros dígitos de um CNPJ.
  for (const achado of texto.matchAll(REGEX_PADRAO_DOCUMENTO)) {
    candidatos.push(achado[1] ?? achado[0]);
  }

  let candidatoSemValidacao: DocumentoDetectado | null = null;

  for (const bruto of candidatos) {
    const numero = apenasDigitos(bruto);
    if (numero.length !== 11 && numero.length !== 14) continue;

    if (numero.length === 11) {
      if (validarCpf(numero)) return { numero, tipo: 'cpf' };
      candidatoSemValidacao ??= { numero, tipo: 'cpf' };
      continue;
    }

    if (validarCnpj(numero)) return { numero, tipo: 'cnpj' };

    // O BB preenche o CPF do pagador com zeros à esquerda até 14 dígitos
    // ("00052998224725" = CPF 529.982.247-25). Sem tratar isso, nenhum Pix de
    // pessoa física teria documento e a camada 2 do motor nunca casaria.
    const cpfInterno = numero.slice(3);
    if (numero.startsWith('000') && validarCpf(cpfInterno)) {
      return { numero: cpfInterno, tipo: 'cpf' };
    }

    candidatoSemValidacao ??= { numero, tipo: 'cnpj' };
  }

  return validarDigito ? null : candidatoSemValidacao;
}
