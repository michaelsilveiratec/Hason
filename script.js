(() => {
  "use strict";

  const MONTHS_PER_YEAR = 12;
  const RATE_SCALE = 1000000n;
  const MAX_GOAL_CENTS = 9999999999999n;
  const DEFAULT_GOAL = "10000.00";
  const DEFAULT_YEARS = "10";
  const DEFAULT_RATE = "1";
  const currencyWholeFormatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  });

  const form = document.querySelector("#planner-form");
  const goalInput = document.querySelector("#monthly-goal");
  const yearsInput = document.querySelector("#planning-years");
  const rateInput = document.querySelector("#monthly-rate");
  const errorMessage = document.querySelector("#form-error");
  const rows = document.querySelector("#projection-rows");
  const chartConfigs = [
    {
      plot: document.querySelector("#wealth-chart-plot"),
      topLabel: document.querySelector("#wealth-chart-top-label"),
      middleLabel: document.querySelector("#wealth-chart-middle-label"),
      figure: document.querySelector("#wealth-chart"),
      value: (year) => year.finalCapitalCents,
      barClass: "chart-bar",
      description: "património acumulado ao final de cada ano",
    },
    {
      plot: document.querySelector("#contribution-chart-plot"),
      topLabel: document.querySelector("#contribution-chart-top-label"),
      middleLabel: document.querySelector("#contribution-chart-middle-label"),
      figure: document.querySelector("#contribution-chart"),
      value: (year) => year.ownMonthlyCents,
      barClass: "chart-bar chart-bar-contribution",
      description: "aporte mensal do próprio bolso por ano",
    },
  ];

  function parseCents(value) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
      return null;
    }

    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }

  function parseRate(value) {
    if (!/^\d+(?:\.\d{1,4})?$/.test(value)) {
      return null;
    }

    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, "0"));
  }

  function formatBRL(cents) {
    const whole = cents / 100n;
    const fraction = String(cents % 100n).padStart(2, "0");
    return `R$ ${currencyWholeFormatter.format(whole)},${fraction}`;
  }

  function formatPercent(rateUnits) {
    const whole = rateUnits / 10000n;
    const fraction = String(rateUnits % 10000n).padStart(4, "0").replace(/0+$/, "");
    return fraction
      ? `${currencyWholeFormatter.format(whole)},${fraction}%`
      : `${currencyWholeFormatter.format(whole)}%`;
  }

  function calculateMonthlyEarnings(capitalCents, rateUnits) {
    // A taxa percentual é escalada para inteiros; o rendimento de cada mês arredonda para centavos.
    return (capitalCents * rateUnits + RATE_SCALE / 2n) / RATE_SCALE;
  }

  function calculateProjection(goalCents, years, rateUnits) {
    const projection = [];
    let capitalCents = 0n;
    let totalOwnCents = 0n;
    let totalEarningsCents = 0n;

    for (let year = 1; year <= years; year += 1) {
      const initialCapitalCents = capitalCents;
      const referenceMonthlyEarningsCents = calculateMonthlyEarnings(initialCapitalCents, rateUnits);
      const ownMonthlyCents =
        referenceMonthlyEarningsCents >= goalCents
          ? 0n
          : goalCents - referenceMonthlyEarningsCents;
      let ownAnnualCents = 0n;
      let earningsAnnualCents = 0n;

      for (let month = 0; month < MONTHS_PER_YEAR; month += 1) {
        const monthlyEarningsCents = calculateMonthlyEarnings(capitalCents, rateUnits);
        capitalCents += monthlyEarningsCents + ownMonthlyCents;
        ownAnnualCents += ownMonthlyCents;
        earningsAnnualCents += monthlyEarningsCents;
      }

      totalOwnCents += ownAnnualCents;
      totalEarningsCents += earningsAnnualCents;
      projection.push({
        year,
        initialCapitalCents,
        referenceMonthlyEarningsCents,
        ownMonthlyCents,
        ownAnnualCents,
        earningsAnnualCents,
        finalCapitalCents: capitalCents,
      });
    }

    return { years: projection, totalOwnCents, totalEarningsCents };
  }

  function validateInputs() {
    const goalValue = goalInput.value.trim();
    const goalCents = parseCents(goalValue);

    if (!goalValue || goalCents === null || goalCents <= 0n || goalCents > MAX_GOAL_CENTS) {
      return {
        invalidInput: goalInput,
        error: "Informe uma meta mensal válida entre R$ 0,01 e R$ 99.999.999.999,99.",
      };
    }

    const yearsValue = yearsInput.value.trim();
    const years = Number(yearsValue);
    if (!/^\d+$/.test(yearsValue) || !Number.isInteger(years) || years < 1 || years > 50) {
      return {
        invalidInput: yearsInput,
        error: "Informe um prazo inteiro entre 1 e 50 anos.",
      };
    }

    const rateValue = rateInput.value.trim();
    const rateUnits = parseRate(rateValue);
    if (!rateValue || rateUnits === null || rateUnits > 1000000n) {
      return {
        invalidInput: rateInput,
        error: "Informe uma rentabilidade mensal entre 0% e 100%, com até quatro casas decimais.",
      };
    }

    return { goalCents, years, rateUnits };
  }

  function createCell(content) {
    const cell = document.createElement("td");
    cell.textContent = content;
    return cell;
  }

  function renderTable(projection) {
    const fragment = document.createDocumentFragment();

    projection.years.forEach((item) => {
      const row = document.createElement("tr");
      row.append(
        createCell(`Ano ${item.year}`),
        createCell(formatBRL(item.initialCapitalCents)),
        createCell(formatBRL(item.referenceMonthlyEarningsCents)),
        createCell(formatBRL(item.ownMonthlyCents)),
        createCell(formatBRL(item.ownAnnualCents)),
        createCell(formatBRL(item.earningsAnnualCents)),
        createCell(formatBRL(item.finalCapitalCents)),
      );
      fragment.append(row);
    });

    rows.replaceChildren(fragment);
  }

  function abbreviatedBRL(cents) {
    const whole = cents / 100n;
    if (whole < 10000n) {
      return formatBRL(cents);
    }

    const digits = whole.toString();
    const exponent = digits.length - 1;
    if (exponent >= 12) {
      const significant = digits.slice(0, 3).padEnd(3, "0");
      const fractional = `${significant[1]}${significant[2]}`;
      return `R$ ${significant[0]},${fractional} × 10^${exponent}`;
    }

    const units = [
      { threshold: 1000000000n, divisor: 1000000000n, suffix: " bi" },
      { threshold: 1000000n, divisor: 1000000n, suffix: " mi" },
      { threshold: 10000n, divisor: 1000n, suffix: " mil" },
    ];
    const unit = units.find((candidate) => whole >= candidate.threshold);
    const hundredths = (whole * 100n) / unit.divisor;
    const amount = Number(hundredths) / 100;
    const decimals = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
    return `R$ ${amount.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${unit.suffix}`;
  }

  function renderChart(config, projection) {
    const maxValue = projection.reduce(
      (maximum, item) => (config.value(item) > maximum ? config.value(item) : maximum),
      0n,
    );
    const scale = maxValue === 0n ? 1n : maxValue;
    const fragment = document.createDocumentFragment();

    projection.forEach((item) => {
      const valueCents = config.value(item);
      const group = document.createElement("div");
      group.className = "chart-bar-group";

      const value = document.createElement("span");
      value.className = "chart-value";
      value.textContent = abbreviatedBRL(valueCents);
      value.title = formatBRL(valueCents);

      const bar = document.createElement("span");
      bar.className = config.barClass;
      bar.style.height = `${Number((valueCents * 10000n) / scale) / 100}%`;

      const year = document.createElement("span");
      year.className = "chart-year";
      year.textContent = `Ano ${item.year}`;

      group.append(value, bar, year);
      fragment.append(group);
    });

    config.plot.replaceChildren(fragment);
    config.topLabel.textContent = abbreviatedBRL(maxValue);
    config.middleLabel.textContent = abbreviatedBRL(maxValue / 2n);
    config.figure.setAttribute(
      "aria-label",
      `Gráfico de barras de ${config.description}: ${projection
        .map((item) => `ano ${item.year}, ${formatBRL(config.value(item))}`)
        .join("; ")}.`,
    );
  }

  function renderMetrics(projection) {
    const firstYear = projection.years[0];
    const lastYear = projection.years[projection.years.length - 1];
    const yearWithZeroContribution = projection.years.find((item) => item.ownMonthlyCents === 0n);

    document.querySelector("#final-wealth").textContent = formatBRL(
      lastYear.finalCapitalCents,
    );
    document.querySelector("#total-own-contributions").textContent = formatBRL(
      projection.totalOwnCents,
    );
    document.querySelector("#total-earnings").textContent = formatBRL(
      projection.totalEarningsCents,
    );
    document.querySelector("#first-year-contribution").textContent = formatBRL(
      firstYear.ownMonthlyCents,
    );
    document.querySelector("#last-year-contribution").textContent = formatBRL(
      lastYear.ownMonthlyCents,
    );
    document.querySelector("#last-year-caption").textContent = `por mês · ano ${lastYear.year}`;
    document.querySelector("#effort-reduction").textContent = formatBRL(
      firstYear.ownMonthlyCents - lastYear.ownMonthlyCents,
    );
    document.querySelector("#zero-contribution-year").textContent = yearWithZeroContribution
      ? `Ano ${yearWithZeroContribution.year}`
      : "Não atingido";
    document.querySelector("#zero-contribution-caption").textContent = yearWithZeroContribution
      ? "a partir deste ano, os rendimentos estimados cobrem a meta mensal"
      : "os rendimentos estimados não cobrem a meta no período";
  }

  function clearResults() {
    [
      "#final-wealth",
      "#total-own-contributions",
      "#total-earnings",
      "#first-year-contribution",
      "#last-year-contribution",
      "#effort-reduction",
      "#zero-contribution-year",
    ].forEach((selector) => {
      document.querySelector(selector).textContent = "—";
    });
    document.querySelector("#last-year-caption").textContent = "por mês";
    document.querySelector("#zero-contribution-caption").textContent =
      "quando os rendimentos estimados alcançam a meta";
    rows.replaceChildren();
    chartConfigs.forEach((config) => {
      config.plot.replaceChildren();
      config.topLabel.textContent = "—";
      config.middleLabel.textContent = "—";
      config.figure.setAttribute("aria-label", "Gráfico indisponível enquanto os dados forem inválidos.");
    });
  }

  function calculate(focusInvalid = false) {
    const result = validateInputs();
    if (result.error) {
      errorMessage.textContent = result.error;
      errorMessage.hidden = false;
      clearResults();
      if (focusInvalid) {
        result.invalidInput.focus();
      }
      return;
    }

    errorMessage.textContent = "";
    errorMessage.hidden = true;
    const projection = calculateProjection(result.goalCents, result.years, result.rateUnits);
    renderMetrics(projection);
    renderTable(projection);
    chartConfigs.forEach((config) => renderChart(config, projection.years));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculate(true);
  });

  [goalInput, yearsInput, rateInput].forEach((input) => {
    input.addEventListener("input", () => calculate());
  });

  document.querySelector("#reset-button").addEventListener("click", () => {
    goalInput.value = DEFAULT_GOAL;
    yearsInput.value = DEFAULT_YEARS;
    rateInput.value = DEFAULT_RATE;
    calculate();
  });

  calculate();
})();
