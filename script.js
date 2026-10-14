(() => {
  "use strict";

  const REDUCTION_FACTOR = 87n;
  const PERCENT_BASE = 100n;
  const MONTHS_PER_YEAR = 12n;
  const DEFAULT_CONTRIBUTION = "10000.00";
  const DEFAULT_YEARS = "6";
  const MAX_CONTRIBUTION = "99999999999.99";
  const currencyWholeFormatter = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  });

  const form = document.querySelector("#planner-form");
  const contributionInput = document.querySelector("#monthly-contribution");
  const yearsInput = document.querySelector("#planning-years");
  const errorMessage = document.querySelector("#form-error");
  const rows = document.querySelector("#projection-rows");
  const chartPlot = document.querySelector("#chart-plot");

  function parseCents(value) {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
      return null;
    }

    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }

  function formatBRL(cents) {
    const whole = cents / 100n;
    const fraction = String(cents % 100n).padStart(2, "0");
    return `R$ ${currencyWholeFormatter.format(whole)},${fraction}`;
  }

  function formatPercent(basisPoints) {
    const whole = basisPoints / 100n;
    const fraction = String(basisPoints % 100n).padStart(2, "0");
    return `${whole},${fraction}%`;
  }

  function roundReduction(cents) {
    // Arredonda cada novo aporte mensal para centavos antes de calcular o ano seguinte.
    return (cents * REDUCTION_FACTOR + PERCENT_BASE / 2n) / PERCENT_BASE;
  }

  function calculateProjection(initialCents, years) {
    const projection = [];
    let monthlyCents = initialCents;
    let accumulatedCents = 0n;

    for (let year = 1; year <= years; year += 1) {
      const annualCents = monthlyCents * MONTHS_PER_YEAR;
      accumulatedCents += annualCents;

      const monthlyReduction = year === 1 ? 0n : projection[year - 2].monthlyCents - monthlyCents;
      const cumulativeReductionBasisPoints =
        ((initialCents - monthlyCents) * 10000n + initialCents / 2n) / initialCents;

      projection.push({
        year,
        monthlyCents,
        annualCents,
        monthlyReduction,
        cumulativeReductionBasisPoints,
        accumulatedCents,
      });

      if (year < years) {
        monthlyCents = roundReduction(monthlyCents);
      }
    }

    return projection;
  }

  function validateInputs() {
    const contributionValue = contributionInput.value.trim();
    const initialCents = parseCents(contributionValue);
    const yearsValue = yearsInput.value.trim();
    const years = Number(yearsValue);
    const maximumCents = parseCents(MAX_CONTRIBUTION);

    if (!contributionValue || initialCents === null || initialCents <= 0n) {
      return {
        error: "Informe um aporte mensal válido, maior que zero, com até duas casas decimais.",
      };
    }

    if (initialCents > maximumCents) {
      return { error: "O aporte mensal deve ser de no máximo R$ 99.999.999.999,99." };
    }

    if (!/^\d+$/.test(yearsValue) || !Number.isInteger(years) || years < 1 || years > 50) {
      return { error: "Informe um período inteiro entre 1 e 50 anos." };
    }

    return { initialCents, years };
  }

  function createCell(content, className) {
    const cell = document.createElement("td");
    cell.textContent = content;
    if (className) {
      cell.className = className;
    }
    return cell;
  }

  function renderTable(projection) {
    const fragment = document.createDocumentFragment();

    projection.forEach((item) => {
      const row = document.createElement("tr");
      row.append(
        createCell(`Ano ${item.year}`),
        createCell(formatBRL(item.monthlyCents)),
        createCell(formatBRL(item.annualCents)),
        createCell(formatBRL(item.monthlyReduction)),
        createCell(formatPercent(item.cumulativeReductionBasisPoints)),
        createCell(formatBRL(item.accumulatedCents)),
      );
      fragment.append(row);
    });

    rows.replaceChildren(fragment);
  }

  function abbreviatedBRL(cents) {
    const whole = Number(cents / 100n);
    const units = [
      { threshold: 1_000_000_000, divisor: 1_000_000_000, suffix: " bi" },
      { threshold: 1_000_000, divisor: 1_000_000, suffix: " mi" },
      { threshold: 10_000, divisor: 1_000, suffix: " mil" },
    ];
    const unit = units.find((candidate) => whole >= candidate.threshold);

    if (!unit) {
      return formatBRL(cents);
    }

    const amount = whole / unit.divisor;
    const decimals = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
    return `R$ ${amount.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${unit.suffix}`;
  }

  function renderChart(projection) {
    const maxCents = projection[0].monthlyCents;
    const fragment = document.createDocumentFragment();

    projection.forEach((item) => {
      const group = document.createElement("div");
      group.className = "chart-bar-group";

      const value = document.createElement("span");
      value.className = "chart-value";
      value.textContent = abbreviatedBRL(item.monthlyCents);
      value.title = formatBRL(item.monthlyCents);

      const bar = document.createElement("span");
      bar.className = "chart-bar";
      bar.style.height = `${Number((item.monthlyCents * 10000n) / maxCents) / 100}%`;

      const year = document.createElement("span");
      year.className = "chart-year";
      year.textContent = `Ano ${item.year}`;

      group.append(value, bar, year);
      fragment.append(group);
    });

    chartPlot.replaceChildren(fragment);
    document.querySelector("#chart-top-label").textContent = abbreviatedBRL(maxCents);
    document.querySelector("#chart-middle-label").textContent = abbreviatedBRL(maxCents / 2n);
    document.querySelector("#contribution-chart").setAttribute(
      "aria-label",
      `Gráfico de barras do aporte mensal: ${projection
        .map((item) => `ano ${item.year}, ${formatBRL(item.monthlyCents)}`)
        .join("; ")}.`,
    );
  }

  function renderMetrics(projection, initialCents, years) {
    const finalYear = projection[projection.length - 1];
    const constantContributionTotal = initialCents * MONTHS_PER_YEAR * BigInt(years);
    const totalReduction = initialCents - finalYear.monthlyCents;
    const savings = constantContributionTotal - finalYear.accumulatedCents;

    document.querySelector("#total-contributed").textContent = formatBRL(finalYear.accumulatedCents);
    document.querySelector("#initial-contribution").textContent = formatBRL(initialCents);
    document.querySelector("#final-contribution").textContent = formatBRL(finalYear.monthlyCents);
    document.querySelector("#final-contribution-caption").textContent = `por mês · ano ${years}`;
    document.querySelector("#monthly-reduction").textContent = formatBRL(totalReduction);
    document.querySelector("#contribution-savings").textContent = formatBRL(savings);
  }

  function calculate() {
    const result = validateInputs();

    if (result.error) {
      errorMessage.textContent = result.error;
      errorMessage.hidden = false;
      (result.error.includes("aporte") ? contributionInput : yearsInput).focus();
      return;
    }

    errorMessage.textContent = "";
    errorMessage.hidden = true;

    const projection = calculateProjection(result.initialCents, result.years);
    renderMetrics(projection, result.initialCents, result.years);
    renderTable(projection);
    renderChart(projection);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculate();
  });

  document.querySelector("#reset-button").addEventListener("click", () => {
    contributionInput.value = DEFAULT_CONTRIBUTION;
    yearsInput.value = DEFAULT_YEARS;
    calculate();
  });

  calculate();
})();
