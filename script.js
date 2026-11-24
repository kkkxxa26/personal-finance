/* =========================================================
   PERSONAL FINANCE — application logic
   ========================================================= */

"use strict";

console.info("Personal Finance запущен!");

/* =========================
   STORAGE HELPERS
========================= */

function readStorage(key, fallback) {
    try {
        const rawValue = localStorage.getItem(key);

        if (rawValue === null) {
            return fallback;
        }

        return JSON.parse(rawValue);
    } catch (error) {
        console.error(`Не удалось прочитать "${key}" из localStorage:`, error);
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Не удалось сохранить "${key}" в localStorage:`, error);
        return false;
    }
}

function isValidAmount(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/* =========================
   ACCOUNTS
========================= */

const savedAccounts = readStorage("accounts", {});
const legacyAccounts =
    savedAccounts && typeof savedAccounts === "object" && !Array.isArray(savedAccounts)
        ? savedAccounts
        : {};

let accounts;

if (Object.prototype.hasOwnProperty.call(legacyAccounts, "personal")) {
    // Новая структура счетов.
    accounts = {
        personal: isValidAmount(Number(legacyAccounts.personal))
            ? Number(legacyAccounts.personal)
            : 0,
        simbaCredit: isValidAmount(Number(legacyAccounts.simbaCredit))
            ? Number(legacyAccounts.simbaCredit)
            : 6000
    };
} else {
    // Перенос старых балансов в новую структуру.
    const oldOptima = Number(legacyAccounts.optima) || 0;
    const oldSimbaPersonal = Number(legacyAccounts.simbaPersonal) || 0;
    const oldSimbaCredit = Number(legacyAccounts.simbaCredit);

    accounts = {
        personal: Math.max(0, oldOptima + oldSimbaPersonal),
        simbaCredit: isValidAmount(oldSimbaCredit) ? oldSimbaCredit : 6000
    };
}

writeStorage("accounts", accounts);

/* =========================
   HTML ELEMENTS
========================= */

const expenseForm = document.getElementById("expense-form");
const expenseDate = document.getElementById("expense-date");
const expenseAmount = document.getElementById("expense-amount");
const expenseCategory = document.getElementById("expense-category");
const expenseAccount = document.getElementById("expense-account");

const personalElement = document.getElementById("personal-balance");
const simbaCreditElement = document.getElementById("simba-credit-balance");
const transactionsList = document.getElementById("transactions-list");

const expensesTotalElement = document.getElementById("expenses-total");
const periodButton = document.querySelector(".period-button");

const quickExpense = document.getElementById("quick-expense");
const mobileAddExpenseButton = document.getElementById("mobile-add-expense");
const closeExpenseButton = document.getElementById("close-expense");

const mobileProfileButton = document.getElementById("mobile-profile-button");
const mobileProfileMenu = document.getElementById("mobile-profile-menu");

const requiredElements = [
    expenseForm,
    expenseDate,
    expenseAmount,
    expenseCategory,
    expenseAccount,
    personalElement,
    simbaCreditElement,
    transactionsList
];

if (requiredElements.some((element) => !element)) {
    throw new Error(
        "Не найдены необходимые HTML-элементы. Проверьте ID формы, счетов и списка операций."
    );
}

/* =========================
   DATE AND FORMAT HELPERS
========================= */

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2
});

function formatMoney(value) {
    return `${currencyFormatter.format(value)} сом`;
}

function getLocalISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDisplayDate(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return isoDate;
    }

    return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long"
    });
}

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    const date = new Date(year, month - 1, 1);

    return date.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric"
    });
}

const currentMonthKey = getCurrentMonthKey();

expenseDate.value = getLocalISODate();
if (periodButton) {
    periodButton.textContent = formatMonthLabel(currentMonthKey);
}

/* =========================
   TRANSACTIONS STORAGE
========================= */

const savedTransactions = readStorage("transactions", []);

let transactions = Array.isArray(savedTransactions)
    ? savedTransactions.filter((transaction) => {
        return transaction && typeof transaction === "object";
    })
    : [];

/* =========================
   SAVE APPLICATION STATE
========================= */

function saveExpenseState(nextAccounts, nextTransactions) {
    const previousAccounts = localStorage.getItem("accounts");
    const previousTransactions = localStorage.getItem("transactions");

    try {
        localStorage.setItem("accounts", JSON.stringify(nextAccounts));
        localStorage.setItem("transactions", JSON.stringify(nextTransactions));
        return true;
    } catch (error) {
        // Пытаемся вернуть предыдущее состояние, если одна из записей не удалась.
        try {
            if (previousAccounts === null) {
                localStorage.removeItem("accounts");
            } else {
                localStorage.setItem("accounts", previousAccounts);
            }

            if (previousTransactions === null) {
                localStorage.removeItem("transactions");
            } else {
                localStorage.setItem("transactions", previousTransactions);
            }
        } catch (rollbackError) {
            console.error("Не удалось восстановить предыдущее состояние:", rollbackError);
        }

        console.error("Не удалось сохранить операцию:", error);
        return false;
    }
}

/* =========================
   UPDATE BALANCES
========================= */

function updateBalances() {
    personalElement.textContent = formatMoney(accounts.personal);
    simbaCreditElement.textContent = formatMoney(accounts.simbaCredit);
}

function calculateMonthlyExpenses(monthKey = currentMonthKey) {
    return transactions.reduce((total, transaction) => {
        if (transaction.type !== "expense") {
            return total;
        }

        // Для корректной аналитики используем ISO-дату.
        // Старые операции без dateISO остаются в истории, но не попадают
        // в месячный расчёт, поскольку их год нельзя определить надёжно.
        const transactionMonth = typeof transaction.dateISO === "string"
            ? transaction.dateISO.slice(0, 7)
            : null;

        if (transactionMonth !== monthKey) {
            return total;
        }

        const amount = Number(transaction.amount);

        if (!Number.isFinite(amount)) {
            return total;
        }

        return total + Math.abs(amount);
    }, 0);
}

function updateFinancialSummary() {
    if (!expensesTotalElement) {
        return;
    }

    expensesTotalElement.textContent = formatMoney(
        calculateMonthlyExpenses()
    );
}

/* =========================
   TRANSACTION RENDERING
========================= */

const categoryIcons = {
    "Продукты": "🛒",
    "Кофе и рестораны": "☕",
    "Транспорт": "🚕",
    "Покупки": "🛍️",
    "Красота и уход": "💄",
    "Другое": "📦"
};

function createTransactionElement(transaction) {
    const row = document.createElement("div");
    row.className = "transaction-row";

    const info = document.createElement("div");
    info.className = "transaction-info";

    const icon = document.createElement("div");
    icon.className = "transaction-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = transaction.icon || "📦";

    const details = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = transaction.title || transaction.category || "Операция";

    const description = document.createElement("p");
    const dateText = transaction.date || transaction.dateISO || "";
    const timeText = transaction.time || "";

    description.textContent = [
        transaction.category || "",
        dateText,
        timeText
    ].filter(Boolean).join(" · ");

    details.append(title, description);
    info.append(icon, details);

    const account = document.createElement("span");
    account.className = "transaction-account";
    account.textContent = transaction.account || "Счёт не указан";

    const amount = document.createElement("strong");
    const numericAmount = Number(transaction.amount) || 0;
    amount.className = transaction.type === "expense"
        ? "expense"
        : "income-amount";
    amount.textContent = `${formatMoney(numericAmount)}`;

    row.append(info, account, amount);

    return row;
}

function renderTransactions() {
    transactionsList.replaceChildren();

    if (transactions.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-state";
        emptyMessage.textContent = "Пока нет операций. Добавьте первый расход.";
        transactionsList.append(emptyMessage);
        return;
    }

    const fragment = document.createDocumentFragment();

    transactions.forEach((transaction) => {
        fragment.append(createTransactionElement(transaction));
    });

    transactionsList.append(fragment);
}

/* =========================
   MOBILE EXPENSE FORM
========================= */

function openMobileExpenseForm() {
    if (!quickExpense) {
        return;
    }

    quickExpense.classList.add("mobile-expense-open");

    if (closeExpenseButton) {
        closeExpenseButton.focus();
    }
}

function closeMobileExpenseForm() {
    if (!quickExpense) {
        return;
    }

    quickExpense.classList.remove("mobile-expense-open");

    if (mobileAddExpenseButton) {
        mobileAddExpenseButton.focus();
    }
}

if (mobileAddExpenseButton) {
    mobileAddExpenseButton.addEventListener("click", openMobileExpenseForm);
}

if (closeExpenseButton) {
    closeExpenseButton.addEventListener("click", closeMobileExpenseForm);
}

/* =========================
   MOBILE NAVIGATION
========================= */

function scrollToSection(targetId) {
    const target = document.getElementById(targetId);

    if (!target) {
        return;
    }

    target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        block: "start"
    });

    document.querySelectorAll(".mobile-nav-item").forEach((button) => {
        const isActive = button.dataset.target === targetId;
        button.classList.toggle("active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "location");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

document.querySelectorAll(".mobile-nav-item[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
        const targetId = button.dataset.target;

        if (targetId) {
            scrollToSection(targetId);
        }
    });
});

/* =========================
   MOBILE PROFILE MENU
========================= */

function setProfileMenuOpen(isOpen) {
    if (!mobileProfileMenu || !mobileProfileButton) {
        return;
    }

    mobileProfileMenu.hidden = !isOpen;
    mobileProfileButton.setAttribute("aria-expanded", String(isOpen));
}

if (mobileProfileButton && mobileProfileMenu) {
    mobileProfileButton.addEventListener("click", () => {
        const isOpen = mobileProfileButton.getAttribute("aria-expanded") === "true";
        setProfileMenuOpen(!isOpen);
    });

    document.addEventListener("click", (event) => {
        const clickedInsideMenu = mobileProfileMenu.contains(event.target);
        const clickedProfileButton = mobileProfileButton.contains(event.target);

        if (!clickedInsideMenu && !clickedProfileButton) {
            setProfileMenuOpen(false);
        }
    });

    mobileProfileMenu.addEventListener("click", (event) => {
        const menuButton = event.target.closest("button");

        if (!menuButton) {
            return;
        }

        // Переходы выполняются только для реально существующих разделов.
        const menuTargets = {
            "Обзор": "quick-expense",
            "Долги": null,
            "Аналитика": "summary-section",
            "Настройки": null
        };

        const targetId = menuTargets[menuButton.textContent.trim()];

        if (targetId) {
            setProfileMenuOpen(false);
            scrollToSection(targetId);
        }
    });
}

/* =========================
   KEYBOARD SUPPORT
========================= */

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
        return;
    }

    if (quickExpense?.classList.contains("mobile-expense-open")) {
        closeMobileExpenseForm();
    }

    setProfileMenuOpen(false);
});

/* =========================
   ADD EXPENSE
========================= */

expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const amountInput = Number(expenseAmount.value);
    const category = expenseCategory.value;
    const selectedAccount = expenseAccount.value;
    const dateISO = expenseDate.value;

    if (
        !Number.isFinite(amountInput) ||
        amountInput <= 0 ||
        !category ||
        !selectedAccount ||
        !dateISO
    ) {
        alert("Проверьте заполнение формы.");
        return;
    }

    // Храним денежные значения в целых копейках, чтобы избежать
    // типичных ошибок арифметики с десятичными числами.
    const amountInMinorUnits = Math.round(amountInput * 100);
    const amount = amountInMinorUnits / 100;

    if (!Number.isSafeInteger(amountInMinorUnits) || amountInMinorUnits <= 0) {
        alert("Укажите корректную сумму расхода.");
        return;
    }

    const accountKeys = {
        personal: "personal",
        "simba-credit": "simbaCredit"
    };

    const accountNames = {
        personal: "Личные средства",
        "simba-credit": "Simba — кредитный лимит"
    };

    const accountKey = accountKeys[selectedAccount];

    if (!accountKey || !Object.prototype.hasOwnProperty.call(accounts, accountKey)) {
        alert("Выбран неизвестный счёт.");
        return;
    }

    if (amount > accounts[accountKey]) {
        alert("Недостаточно средств на выбранном счёте.");
        return;
    }

    const parsedDate = new Date(`${dateISO}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime()) || getLocalISODate(parsedDate) !== dateISO) {
        alert("Укажите корректную дату операции.");
        return;
    }

    const now = new Date();

    const newTransaction = {
        id: (window.crypto && typeof window.crypto.randomUUID === "function")
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: category,
        category,
        amount: -amount,
        account: accountNames[selectedAccount],
        date: formatDisplayDate(dateISO),
        dateISO,
        time: now.toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit"
        }),
        icon: categoryIcons[category] || "📦",
        type: "expense"
    };

    const nextAccounts = {
        ...accounts,
        [accountKey]: Math.round((accounts[accountKey] - amount) * 100) / 100
    };

    const nextTransactions = [newTransaction, ...transactions];

    // Сначала сохраняем данные. Интерфейс обновляем только после успеха.
    const saved = saveExpenseState(nextAccounts, nextTransactions);

    if (!saved) {
        alert("Не удалось сохранить операцию. Проверьте доступное место в браузере.");
        return;
    }

    accounts = nextAccounts;
    transactions = nextTransactions;

    updateBalances();
    renderTransactions();
    updateFinancialSummary();

    expenseForm.reset();
    expenseDate.value = getLocalISODate();

    closeMobileExpenseForm();

    alert("Расход успешно добавлен!");
});

/* =========================
   INITIAL RENDER
========================= */

updateBalances();
renderTransactions();
updateFinancialSummary();
setProfileMenuOpen(false);

/*
   Важно:
   - Simba здесь учитывается как доступный остаток кредитного лимита.
   - Зарплата и накопления не пересчитываются автоматически:
     в текущей HTML-форме нет сценариев добавления дохода или изменения целей.
   - Для старых операций без dateISO невозможно надёжно определить месяц,
     поэтому они отображаются в истории, но не включаются в месячную аналитику.
*/
