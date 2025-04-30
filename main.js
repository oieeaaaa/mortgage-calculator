window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("mortgage-form");
  const resultsDiv = document.getElementById("results");
  const monthlyPaymentEl = document.getElementById("monthlyPayment");
  const extraPaymentDisplayEl = document.getElementById("extraPaymentDisplay"); // New display element
  const totalMonthlyPaymentDisplayEl = document.getElementById(
    "totalMonthlyPaymentDisplay",
  ); // New display element
  const originalTermDisplayEl = document.getElementById("originalTermDisplay"); // New display element
  const actualTermDisplayEl = document.getElementById("actualTermDisplay"); // New display element
  const timeSavedDisplayEl = document.getElementById("timeSavedDisplay"); // New display element
  const totalPrincipalEl = document.getElementById("totalPrincipal");
  const totalInterestEl = document.getElementById("totalInterest");
  const totalCostEl = document.getElementById("totalCost");
  const interestSavedDisplayEl = document.getElementById(
    "interestSavedDisplay",
  ); // New display element
  const amortizationBody = document.getElementById("amortization-body");
  const generalErrorEl = document.getElementById("generalError");

  // Input fields and their error message elements
  const loanAmountInput = document.getElementById("loanAmount");
  const interestRateInput = document.getElementById("interestRate");
  const loanTermInput = document.getElementById("loanTerm");
  const extraPaymentInput = document.getElementById("extraPayment"); // New input field
  const loanAmountError = document.getElementById("loanAmountError");
  const interestRateError = document.getElementById("interestRateError");
  const loanTermError = document.getElementById("loanTermError");
  const extraPaymentError = document.getElementById("extraPaymentError"); // New error element

  // --- Utility Functions ---
  const formatCurrency = (value) =>
    value.toLocaleString("en-US", { style: "currency", currency: "PHP" });
  const formatYearsMonths = (totalMonths) => {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    let result = "";
    if (years > 0) {
      result += `${years} year${years > 1 ? "s" : ""}`;
    }
    if (months > 0) {
      result += `${years > 0 ? " " : ""}${months} month${months > 1 ? "s" : ""}`;
    }
    return result || "0 months";
  };

  // Simple debounce function
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Format number with commas
  const formatNumber = (input) => {
    // Get the current value without commas
    const value = input.value.replace(/,/g, '');
    
    // Only allow numbers
    if (!/^\d*$/.test(value)) {
      input.value = value.replace(/[^\d]/g, '');
      return;
    }
    
    // Format with commas
    if (value) {
      input.value = value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  };

  // --- Input Validation ---
  function validateRequiredInput(input, errorEl, message) {
    // Specific validation for required fields (Loan Amount, Interest Rate, Loan Term)
    if (!input.value || parseFloat(input.value) <= 0) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
      input.classList.add("border-red-500");
      return false;
    } else {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      input.classList.remove("border-red-500");
      return true;
    }
  }

  function validateOptionalPositiveInput(input, errorEl, message) {
    // Specific validation for optional, non-negative fields (Extra Payment)
    const value = input.value;
    if (value && parseFloat(value) < 0) {
      // Only validate if a value exists and it's negative
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
      input.classList.add("border-red-500");
      return false;
    } else {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
      input.classList.remove("border-red-500");
      return true;
    }
  }

  // --- Calculation Logic ---
  function calculateMortgage(
    principal,
    annualRate,
    termYears,
    extraPayment = 0,
  ) {
    // Convert annual rate to monthly decimal rate
    const monthlyRate = annualRate / 100 / 12;
    // Convert term in years to number of months
    const originalNumberOfPayments = termYears * 12;

    // Calculate base monthly payment (P&I)
    let baseMonthlyPayment;
    if (monthlyRate === 0) {
      baseMonthlyPayment = principal / originalNumberOfPayments;
    } else {
      const factor = Math.pow(1 + monthlyRate, originalNumberOfPayments);
      baseMonthlyPayment = (principal * (monthlyRate * factor)) / (factor - 1);
    }

    // Calculate amortization with extra payments
    const { schedule, totalInterestPaid, actualNumberOfPayments } =
      generateAmortization(
        principal,
        monthlyRate,
        originalNumberOfPayments,
        baseMonthlyPayment,
        extraPayment,
      );

    // Calculate total cost with extra payments
    const totalCost = principal + totalInterestPaid;

    // Calculate results without extra payments for comparison
    const baseResults = generateAmortization(
      principal,
      monthlyRate,
      originalNumberOfPayments,
      baseMonthlyPayment,
      0,
    );
    const baseTotalInterest = baseResults.totalInterestPaid;
    const interestSaved = baseTotalInterest - totalInterestPaid;

    return {
      baseMonthlyPayment: baseMonthlyPayment,
      extraMonthlyPayment: extraPayment,
      totalMonthlyPayment: baseMonthlyPayment + extraPayment,
      totalPrincipal: principal,
      totalInterest: totalInterestPaid, // Actual interest paid with extra payments
      totalCost: totalCost, // Actual total cost with extra payments
      amortization: schedule,
      originalNumberOfPayments: originalNumberOfPayments,
      actualNumberOfPayments: actualNumberOfPayments, // Actual number of payments made
      interestSaved: interestSaved,
    };
  }

  // --- Amortization Schedule Generation (Handles Extra Payments) ---
  function generateAmortization(
    principal,
    monthlyRate,
    maxNumberOfPayments,
    baseMonthlyPayment,
    extraPayment = 0,
  ) {
    let remainingBalance = principal;
    const schedule = [];
    let totalInterestPaid = 0;
    let actualNumberOfPayments = 0;

    for (let i = 1; i <= maxNumberOfPayments; i++) {
      actualNumberOfPayments = i; // Track the number of payments made
      const interestPayment = remainingBalance * monthlyRate;
      let principalFromBasePayment = baseMonthlyPayment - interestPayment;

      // Ensure principal payment doesn't exceed remaining balance if base payment is enough
      if (principalFromBasePayment > remainingBalance) {
        principalFromBasePayment = remainingBalance;
        // Base monthly payment might be reduced in the very last payment if interest is low
        baseMonthlyPayment = interestPayment + principalFromBasePayment;
      }

      // Total principal for this month = base principal + extra payment
      // But ensure total principal doesn't exceed remaining balance
      let currentExtraPayment = extraPayment;
      let totalPrincipalPayment =
        principalFromBasePayment + currentExtraPayment;

      if (totalPrincipalPayment >= remainingBalance) {
        // This is the final payment
        totalPrincipalPayment = remainingBalance; // Pay exactly what's left
        // Recalculate extra payment portion for the final month if needed
        currentExtraPayment = Math.max(
          0,
          totalPrincipalPayment - principalFromBasePayment,
        );
      }

      remainingBalance -= totalPrincipalPayment;
      totalInterestPaid += interestPayment;

      // Total payment this month = potentially adjusted base payment + potentially adjusted extra payment
      const totalPaymentThisMonth = interestPayment + totalPrincipalPayment;

      schedule.push({
        month: i,
        principalBase: principalFromBasePayment,
        principalExtra: currentExtraPayment, // Store how much extra was applied this month
        interestPayment: interestPayment,
        totalPayment: totalPaymentThisMonth,
        remainingBalance: Math.max(0, remainingBalance), // Ensure it doesn't display negative zero
      });

      if (remainingBalance <= 0) {
        break; // Loan paid off
      }
    }
    return { schedule, totalInterestPaid, actualNumberOfPayments };
  }

  // --- Display Results ---
  function displayResults(results) {
    monthlyPaymentEl.textContent = formatCurrency(results.baseMonthlyPayment);
    extraPaymentDisplayEl.textContent = formatCurrency(
      results.extraMonthlyPayment,
    );
    totalMonthlyPaymentDisplayEl.textContent = formatCurrency(
      results.totalMonthlyPayment,
    );

    originalTermDisplayEl.textContent = formatYearsMonths(
      results.originalNumberOfPayments,
    );
    actualTermDisplayEl.textContent = formatYearsMonths(
      results.actualNumberOfPayments,
    );
    timeSavedDisplayEl.textContent = formatYearsMonths(
      results.originalNumberOfPayments - results.actualNumberOfPayments,
    );

    totalPrincipalEl.textContent = formatCurrency(results.totalPrincipal);
    totalInterestEl.textContent = formatCurrency(results.totalInterest);
    totalCostEl.textContent = formatCurrency(results.totalCost);
    interestSavedDisplayEl.textContent = formatCurrency(
      results.interestSaved > 0 ? results.interestSaved : 0,
    ); // Show 0 if no savings

    // Clear previous amortization schedule
    amortizationBody.innerHTML = "";

    // Populate amortization table
    results.amortization.forEach((row) => {
      const tr = document.createElement("tr");
      // Added Principal (Extra) column
      tr.innerHTML = `
                    <td class="whitespace-nowrap text-center">${row.month}</td>
                    <td class="whitespace-nowrap">${formatCurrency(row.principalBase)}</td>
                    <td class="whitespace-nowrap">${formatCurrency(row.principalExtra)}</td>
                    <td class="whitespace-nowrap">${formatCurrency(row.interestPayment)}</td>
                    <td class="whitespace-nowrap">${formatCurrency(row.totalPayment)}</td>
                    <td class="whitespace-nowrap">${formatCurrency(row.remainingBalance)}</td>
                `;
      amortizationBody.appendChild(tr);
    });

    resultsDiv.classList.remove("hidden"); // Show the results section
    generalErrorEl.classList.add("hidden"); // Hide general error message
  }

  // --- Event Listener for Form Submission ---
  form.addEventListener("submit", function (event) {
    event.preventDefault(); // Prevent default form submission

    // Clear previous errors and hide results
    loanAmountError.classList.add("hidden");
    interestRateError.classList.add("hidden");
    loanTermError.classList.add("hidden");
    extraPaymentError.classList.add("hidden"); // Clear extra payment error
    generalErrorEl.classList.add("hidden");
    loanAmountInput.classList.remove("border-red-500");
    interestRateInput.classList.remove("border-red-500");
    loanTermInput.classList.remove("border-red-500");
    extraPaymentInput.classList.remove("border-red-500"); // Clear extra payment border
    resultsDiv.classList.add("hidden");

    // Validate inputs
    const isLoanAmountValid = validateRequiredInput(
      loanAmountInput,
      loanAmountError,
      "Please enter a valid loan amount (> 0).",
    );
    const isInterestRateValid = validateRequiredInput(
      interestRateInput,
      interestRateError,
      "Please enter a valid interest rate (>= 0).",
    ); // Allow 0%
    // Adjust interest rate validation message slightly
    if (interestRateInput.value && parseFloat(interestRateInput.value) < 0) {
      interestRateError.textContent = "Interest rate cannot be negative.";
      interestRateError.classList.remove("hidden");
      interestRateInput.classList.add("border-red-500");
      // Overwrite the return value if it was previously valid but negative
      isInterestRateValid = false;
    }

    const isLoanTermValid = validateRequiredInput(
      loanTermInput,
      loanTermError,
      "Please enter a valid loan term (> 0).",
    );
    const isExtraPaymentValid = validateOptionalPositiveInput(
      extraPaymentInput,
      extraPaymentError,
      "Extra payment cannot be negative.",
    ); // Validate optional extra payment

    if (
      !isLoanAmountValid ||
      !isInterestRateValid ||
      !isLoanTermValid ||
      !isExtraPaymentValid
    ) {
      generalErrorEl.textContent = "Please fix the errors above.";
      generalErrorEl.classList.remove("hidden");
      return; // Stop if validation fails
    }

    // Get validated values
    const principal = parseFloat(loanAmountInput.value.replace(/,/g, ''));
    const annualRate = parseFloat(interestRateInput.value);
    const termYears = parseInt(loanTermInput.value, 10);
    // Get extra payment value, default to 0 if empty or not a number
    const extraPayment = parseFloat(extraPaymentInput.value.replace(/,/g, '')) || 0;

    // Perform calculation
    try {
      const results = calculateMortgage(
        principal,
        annualRate,
        termYears,
        extraPayment,
      );

      // Check for unrealistic results (e.g., NaN or Infinity) - baseMonthlyPayment is a good indicator
      if (
        !isFinite(results.baseMonthlyPayment) ||
        !isFinite(results.totalCost)
      ) {
        throw new Error(
          "Calculation resulted in invalid numbers. Please check your inputs (e.g., very high interest rate or term).",
        );
      }

      // Display results
      displayResults(results);
    } catch (error) {
      console.error("Calculation Error:", error);
      generalErrorEl.textContent = `Calculation error: ${error.message || "Could not calculate mortgage. Please check inputs."}`;
      generalErrorEl.classList.remove("hidden");
      resultsDiv.classList.add("hidden"); // Hide results section on error
    }
  });

  // Add real-time validation feedback
  loanAmountInput.addEventListener("input", () => {
    formatNumber(loanAmountInput);
    validateRequiredInput(
      loanAmountInput,
      loanAmountError,
      "Please enter a valid loan amount (> 0).",
    );
  });
  
  // Add debounced formatting
  const debouncedFormatLoanAmount = debounce(() => formatNumber(loanAmountInput), 300);
  loanAmountInput.addEventListener("input", debouncedFormatLoanAmount);

  interestRateInput.addEventListener("input", () => {
    // Combined validation for interest rate
    const isValidFormat = validateRequiredInput(
      interestRateInput,
      interestRateError,
      "Please enter a valid interest rate (>= 0).",
    );
    if (isValidFormat && parseFloat(interestRateInput.value) < 0) {
      interestRateError.textContent = "Interest rate cannot be negative.";
      interestRateError.classList.remove("hidden");
      interestRateInput.classList.add("border-red-500");
    }
  });

  loanTermInput.addEventListener("input", () =>
    validateRequiredInput(
      loanTermInput,
      loanTermError,
      "Please enter a valid loan term (> 0).",
    )
  );

  extraPaymentInput.addEventListener("input", () => {
    formatNumber(extraPaymentInput);
    validateOptionalPositiveInput(
      extraPaymentInput,
      extraPaymentError,
      "Extra payment cannot be negative.",
    );
  });
  
  // Add debounced formatting
  const debouncedFormatExtraPayment = debounce(() => formatNumber(extraPaymentInput), 300);
  extraPaymentInput.addEventListener("input", debouncedFormatExtraPayment);
});
