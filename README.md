# Hason — A Visão de José do Egito

Simulador educativo de crescimento patrimonial. Defina uma meta mensal de
crescimento, um prazo de 1 a 50 anos e uma rentabilidade mensal estimada. A
simulação calcula o aporte mensal do próprio bolso no início de cada ano com
base nos rendimentos estimados sobre o património acumulado.

## Executar localmente

Abra `index.html` em um navegador. Não é necessário instalar dependências,
configurar um servidor ou criar uma conta.

## Premissas

- O património inicial é R$ 0,00.
- O aporte próprio mensal é calculado uma vez no início de cada ano:
  `máximo de zero ou (meta mensal − rendimento mensal de referência)`.
- A rentabilidade mensal é aplicada sobre o património do mês anterior; o aporte
  próprio definido para o ano é feito ao final de cada mês.
- Rendimentos e património são arredondados para centavos a cada mês.
- A rentabilidade informada é uma estimativa, não é garantida e não inclui
  impostos, inflação ou taxas.
- Os valores informados não são guardados nem enviados para um servidor.

Esta ferramenta apresenta uma simulação matemática com base nas premissas
informadas. Não representa previsão de rentabilidade, recomendação financeira
ou garantia de resultados.
